import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LexicalComposer,
} from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import {
  $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, FORMAT_ELEMENT_COMMAND,
  $createParagraphNode, COMMAND_PRIORITY_NORMAL, UNDO_COMMAND, REDO_COMMAND,
  CAN_UNDO_COMMAND, CAN_REDO_COMMAND, $isTextNode,
} from 'lexical';
import type { LexicalNode } from 'lexical';
import { $setBlocksType, $patchStyleText } from '@lexical/selection';
import { $createHeadingNode, HeadingNode, $createQuoteNode, QuoteNode } from '@lexical/rich-text';
import {
  INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND,
  ListNode, ListItemNode,
} from '@lexical/list';
import { CodeNode, $createCodeNode } from '@lexical/code';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import {
  $generateHtmlFromNodes, $generateNodesFromDOM,
} from '@lexical/html';
import { $getRoot, $insertNodes } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import {
  Bold, Italic, Underline, Strikethrough,
  Undo2, Redo2, Sparkles, RefreshCw, AlignLeft, AlignCenter, AlignRight, AlignJustify, Lightbulb, Zap, Loader2,
  Palette, Highlighter, Code2, Link, ChevronDown, Minus, Plus, Type, Trash2
} from 'lucide-react';
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin';
import { htmlToPlainText } from './note-utils';

type InlineTextFormat = 'bold' | 'italic' | 'underline' | 'strikethrough';

function normalizeAiOutput(value: string): string {
  return value
    .replace(/<br\s*\/?>(?=\s*)/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*{1,3}|_{1,3})(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/\*{2,3}|_{2,3}/g, '')
    .replace(/^\s*(?:[*+-]|•)\s+/gm, '• ')
    .trim();
}

function importInlineElement(element: HTMLElement, format?: InlineTextFormat, styleOverride?: string) {
  const style = styleOverride || element.getAttribute('style') || '';
  return {
    node: null,
    forChild: (lexicalNode: LexicalNode) => {
      if (!$isTextNode(lexicalNode)) return lexicalNode;
      if (format && !lexicalNode.hasFormat(format)) lexicalNode.toggleFormat(format);
      if (style) {
        const existingStyle = lexicalNode.getStyle();
        lexicalNode.setStyle([existingStyle, style].filter(Boolean).join('; '));
      }
      return lexicalNode;
    },
  };
}

const preservedHtmlImport = {
  span: () => ({
    conversion: (element: HTMLElement) => importInlineElement(element),
    priority: 4 as const,
  }),
  font: () => ({
    conversion: (element: HTMLElement) => {
      const style = [
        element.getAttribute('color') ? `color: ${element.getAttribute('color')}` : '',
        element.getAttribute('face') ? `font-family: ${element.getAttribute('face')}` : '',
        element.getAttribute('size') ? `font-size: ${element.getAttribute('size')}pt` : '',
        element.getAttribute('style') || '',
      ].filter(Boolean).join('; ');
      return importInlineElement(element, undefined, style);
    },
    priority: 4 as const,
  }),
  strong: () => ({ conversion: (element: HTMLElement) => importInlineElement(element, 'bold'), priority: 4 as const }),
  b: () => ({ conversion: (element: HTMLElement) => importInlineElement(element, 'bold'), priority: 4 as const }),
  em: () => ({ conversion: (element: HTMLElement) => importInlineElement(element, 'italic'), priority: 4 as const }),
  i: () => ({ conversion: (element: HTMLElement) => importInlineElement(element, 'italic'), priority: 4 as const }),
  u: () => ({ conversion: (element: HTMLElement) => importInlineElement(element, 'underline'), priority: 4 as const }),
  s: () => ({ conversion: (element: HTMLElement) => importInlineElement(element, 'strikethrough'), priority: 4 as const }),
  del: () => ({ conversion: (element: HTMLElement) => importInlineElement(element, 'strikethrough'), priority: 4 as const }),
  mark: () => ({ conversion: (element: HTMLElement) => importInlineElement(element), priority: 4 as const }),
};

/* ── Lexical Rich Theme ── */
const theme = {
  heading: {
    h1: 'text-xl font-serif font-semibold text-foreground mt-4 mb-2 tracking-tight',
    h2: 'text-base font-serif font-semibold text-foreground mt-3 mb-1.5 tracking-tight',
    h3: 'text-sm font-serif font-semibold text-foreground mt-2 mb-1 tracking-tight',
  },
  text: {
    bold:          'font-bold text-foreground',
    italic:        'italic text-foreground/90',
    underline:     'underline underline-offset-4 text-foreground',
    strikethrough: 'line-through text-muted-foreground',
    code:          'font-mono text-[12px] bg-secondary/80 px-1.5 py-0.5 rounded border border-border/50',
  },
  list: {
    ul: 'list-disc pl-5 my-1.5 space-y-0.5',
    ol: 'list-decimal pl-5 my-1.5 space-y-0.5',
    listitem: 'text-[13px] text-foreground/90',
  },
  quote: 'border-l-2 border-primary/60 pl-3.5 my-2 italic text-muted-foreground bg-secondary/20 py-1 rounded-r-lg text-[13px]',
  code: 'block font-mono text-[12px] bg-slate-900 text-emerald-400 border border-border/80 rounded-xl p-3.5 my-2 leading-relaxed shadow-inner overflow-x-auto selection:bg-primary/30',
  paragraph: 'text-[13px] leading-relaxed text-foreground/90 my-1 min-h-[1.5em]',
  link: 'text-blue-500 font-medium underline underline-offset-2 hover:text-blue-600 cursor-pointer',
  table: 'note-editor-table',
  tableCell: 'note-editor-table-cell',
  tableCellHeader: 'note-editor-table-cell-header',
  tableRow: 'note-editor-table-row',
};

const FONTS = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Monospace', value: 'monospace' },
];

const BLOCK_TYPES = [
  { label: 'Normal', value: 'paragraph', shortcut: '⌘+Opt+0' },
  { label: 'Heading 1', value: 'h1', shortcut: '⌘+Opt+1' },
  { label: 'Heading 2', value: 'h2', shortcut: '⌘+Opt+2' },
  { label: 'Heading 3', value: 'h3', shortcut: '⌘+Opt+3' },
  { label: 'Numbered List', value: 'ol', shortcut: '⌘+Shift+7' },
  { label: 'Bullet List', value: 'ul', shortcut: '⌘+Shift+8' },
  { label: 'Quote', value: 'quote', shortcut: '^Shift+Q' },
  { label: 'Code Block', value: 'code', shortcut: '⌘+Opt+C' },
];

const SWATCH_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#854d0e', '#84cc16', '#15803d', '#d946ef',
  '#a855f7', '#3b82f6', '#14b8a6', '#86efac', '#000000', '#475569', '#94a3b8',
  '#ffffff'
];

interface OutlineHeading {
  id: string;
  text: string;
  level: number;
}

const OUTLINE_ELEMENT_SELECTOR = 'h1, h2, h3, h4, h5, h6, p';

function getNormalizedElementText(element: Element): string {
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

function isBoldTextNode(node: Node, inheritedBold = false): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return inheritedBold;
  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const styleWeight = element.style.fontWeight.toLowerCase();
  const classWeight = Array.from(element.classList).some(className => (
    className === 'font-bold' || className === 'font-semibold' || className === 'font-medium'
  ));
  return inheritedBold
    || tag === 'strong'
    || tag === 'b'
    || styleWeight === 'bold'
    || styleWeight === '600'
    || styleWeight === '700'
    || styleWeight === '800'
    || styleWeight === '900'
    || classWeight;
}

function isFullyBold(element: Element): boolean {
  let textLength = 0;
  let boldLength = 0;
  const visit = (node: Node, inheritedBold = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = (node.nodeValue || '').replace(/\s+/g, '').length;
      textLength += length;
      if (inheritedBold) boldLength += length;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const bold = isBoldTextNode(node, inheritedBold);
    Array.from(node.childNodes).forEach(child => visit(child, bold));
  };
  visit(element);
  return textLength > 0 && boldLength / textLength >= 0.95;
}

function getLargestInlineFontSize(element: Element): number {
  let largest = 0;
  const elements = [element, ...Array.from(element.querySelectorAll('*'))];
  elements.forEach(child => {
    const style = child.getAttribute('style') || '';
    const match = style.match(/font-size\s*:\s*([\d.]+)\s*(pt|px)/i);
    if (!match) return;
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) return;
    const points = match[2].toLowerCase() === 'px' ? value * 0.75 : value;
    largest = Math.max(largest, points);
  });
  return largest;
}

function isOutlineHeading(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return true;
  if (tag !== 'p' || element.closest('table, li')) return false;

  const text = getNormalizedElementText(element);
  if (!text || text.length > 140) return false;

  const isNumbered = /^(?:\d+(?:\.\d+)*[.)]?)\s+\S/.test(text);
  const isLarge = getLargestInlineFontSize(element) >= 15;
  return isFullyBold(element) && (isNumbered || isLarge || text.length <= 90);
}

function getOutlineElements(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll(OUTLINE_ELEMENT_SELECTOR)).filter(isOutlineHeading);
}

function getOutlineLevel(element: Element): number {
  const tag = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return Math.min(3, Number.parseInt(tag.slice(1), 10));

  const text = getNormalizedElementText(element);
  const numberMatch = text.match(/^(\d+(?:\.\d+)*)[.)]?\s+/);
  if (numberMatch) return Math.min(3, numberMatch[1].split('.').length);
  return getLargestInlineFontSize(element) >= 18 ? 1 : 2;
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* ── Rich Custom Color Picker Popup ── */
function CustomColorPicker({
  title,
  currentColor,
  onSelectColor,
  onClose,
}: {
  title: string;
  currentColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}) {
  const [hexInput, setHexInput] = useState(currentColor.startsWith('#') ? currentColor : '#000000');
  const [hue, setHue] = useState(0);
  const [pickerPos, setPickerPos] = useState({ x: 0.8, y: 0.2 });
  const containerRef = useRef<HTMLDivElement>(null);
  const spectrumRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDraggingRef.current) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const applyHex = (val: string) => {
    setHexInput(val);
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      onSelectColor(val);
    }
  };

  const updateColorFromPointer = (clientX: number, clientY: number) => {
    if (!spectrumRef.current) return;
    const rect = spectrumRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setPickerPos({ x, y });
    const hex = hsvToHex(hue, x, 1 - y);
    setHexInput(hex);
    onSelectColor(hex);
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    updateColorFromPointer(clientX, clientY);

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      updateColorFromPointer(moveX, moveY);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);
  };

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-full z-50 mt-1 w-64 p-3 rounded-2xl border border-border bg-[#18181b] text-white shadow-2xl animate-in fade-in zoom-in-95"
      onMouseDown={e => { e.stopPropagation(); }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-400">{title} (Hex)</span>
        <input
          value={hexInput}
          onChange={e => applyHex(e.target.value)}
          className="w-28 bg-[#27272a] border border-[#3f3f46] rounded-lg px-2 py-1 font-mono text-xs text-white outline-none focus:border-blue-500"
          placeholder="#000000"
        />
      </div>

      {/* Swatch color grid */}
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {SWATCH_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onMouseDown={e => { e.preventDefault(); setHexInput(c); onSelectColor(c); }}
            className="w-6 h-6 rounded-md border border-white/10 hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      {/* 2D Color Spectrum Box with Circle Scroller Handle */}
      <div
        ref={spectrumRef}
        className="w-full h-32 rounded-lg relative cursor-crosshair mb-2 overflow-hidden select-none touch-none"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`
        }}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
      >
        {/* Visible Circular Scroller Handle */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform"
          style={{
            left: `${pickerPos.x * 100}%`,
            top: `${pickerPos.y * 100}%`,
            backgroundColor: hexInput.startsWith('#') ? hexInput : '#000000',
          }}
        />
      </div>

      {/* Rainbow Hue Slider with Circle Thumb */}
      <div className="mb-2">
        <input
          type="range"
          min="0"
          max="360"
          value={hue}
          onChange={e => {
            const h = parseInt(e.target.value, 10);
            setHue(h);
            const hex = hsvToHex(h, pickerPos.x, 1 - pickerPos.y);
            applyHex(hex);
          }}
          className="w-full h-3 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md"
          style={{
            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#27272a]">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onSelectColor('inherit'); onClose(); }}
          className="text-[11px] text-zinc-400 hover:text-white"
        >
          Reset default
        </button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onClose(); }}
          className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* ── Top Rich Editor Toolbar ── */
function ToolbarPlugin({
  onSave,
  onClearAll,
  hasContent,
  onAiTransform,
}: {
  onSave?: () => void;
  onClearAll?: () => void;
  hasContent?: boolean;
  onAiTransform?: (action: string, selectedText: string) => Promise<string>;
}) {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState('Normal');
  const [fontSize, setFontSize] = useState(16);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [bgMenuOpen, setBgMenuOpen] = useState(false);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [loadingAiAction, setLoadingAiAction] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const closeAllMenus = useCallback(() => {
    setFontMenuOpen(false);
    setBlockMenuOpen(false);
    setColorMenuOpen(false);
    setBgMenuOpen(false);
    setLinkInputOpen(false);
    setAiMenuOpen(false);
  }, []);

  // Close toolbar dropdowns on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        closeAllMenus();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllMenus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeAllMenus]);

  useEffect(() => mergeRegister(
    editor.registerCommand(CAN_UNDO_COMMAND, value => { setCanUndo(value); return false; }, COMMAND_PRIORITY_NORMAL),
    editor.registerCommand(CAN_REDO_COMMAND, value => { setCanRedo(value); return false; }, COMMAND_PRIORITY_NORMAL),
  ), [editor]);

  // Cmd+S / Ctrl+S Save Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  const btn = (active = false) =>
    `h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
      active
        ? 'bg-secondary text-foreground font-semibold shadow-sm'
        : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
    }`;

  const format = (type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  };

  const applyFontFamily = (fontLabel: string, fontValue: string) => {
    setSelectedFont(fontLabel);
    setFontMenuOpen(false);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-family': fontValue });
      }
    });
  };

  const applyBlockType = (blockValue: string, blockLabel: string) => {
    setSelectedBlock(blockLabel);
    setBlockMenuOpen(false);
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (blockValue === 'h1') $setBlocksType(selection, () => $createHeadingNode('h1'));
      else if (blockValue === 'h2') $setBlocksType(selection, () => $createHeadingNode('h2'));
      else if (blockValue === 'h3') $setBlocksType(selection, () => $createHeadingNode('h3'));
      else if (blockValue === 'quote') $setBlocksType(selection, () => $createQuoteNode());
      else if (blockValue === 'code') $setBlocksType(selection, () => $createCodeNode());
      else if (blockValue === 'paragraph') $setBlocksType(selection, () => $createParagraphNode());
    });
    if (blockValue === 'ul') editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    if (blockValue === 'ol') editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(10, Math.min(48, fontSize + delta));
    setFontSize(newSize);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-size': `${newSize}px` });
      }
    });
  };

  const setTextColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color });
      }
    });
  };

  const setBgColor = (backgroundColor: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'background-color': backgroundColor });
      }
    });
  };

  const insertLink = () => {
    if (!linkUrl.trim()) return;
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    setLinkUrl('');
    setLinkInputOpen(false);
  };

  const animateTextReplacement = async (transformedText: string) => {
    const cleanText = normalizeAiOutput(transformedText);
    if (!cleanText) return;

    const words = cleanText.split(/\s+/);
    if (words.length <= 2) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
          selection.insertText(cleanText);
        } else {
          const root = $getRoot();
          root.clear();
          const p = $createParagraphNode();
          p.append(...$generateNodesFromDOM(editor, new DOMParser().parseFromString(cleanText, 'text/html')));
          root.append(p);
        }
      });
      return;
    }

    const chunkSize = Math.max(1, Math.ceil(words.length / 20));
    let currentIdx = chunkSize;

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        selection.insertText(words.slice(0, chunkSize).join(' ') + ' ');
      } else {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.setTextContent(words.slice(0, chunkSize).join(' ') + ' ');
        root.append(p);
      }
    });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (currentIdx >= words.length) {
          clearInterval(interval);
          resolve();
          return;
        }
        const nextWords = words.slice(currentIdx, currentIdx + chunkSize).join(' ');
        currentIdx += chunkSize;

        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertText(nextWords + (currentIdx < words.length ? ' ' : ''));
          }
        });
      }, 30);
    });
  };

  const handleAiOption = async (action: string) => {
    closeAllMenus();
    if (!onAiTransform) return;
    setLoadingAiAction(action);
    try {
      let targetText = '';
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
          targetText = selection.getTextContent();
        } else {
          targetText = $getRoot().getTextContent();
        }
      });
      if (!targetText.trim()) return;
      const result = await onAiTransform(action, targetText);
      if (result) {
        await animateTextReplacement(result);
      }
    } catch (err) {
      console.error('AI toolbar action error:', err);
    } finally {
      setLoadingAiAction(null);
    }
  };

  return (
    <div ref={toolbarRef} className="relative z-30 flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card/80 backdrop-blur-md flex-wrap shrink-0 overflow-visible">
      {/* Undo / Redo */}
      <button type="button" disabled={!canUndo} onMouseDown={e => { e.preventDefault(); if (canUndo) editor.dispatchCommand(UNDO_COMMAND, undefined); }} className={`${btn()} disabled:cursor-not-allowed disabled:opacity-30`} title="Undo (⌘Z)">
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button type="button" disabled={!canRedo} onMouseDown={e => { e.preventDefault(); if (canRedo) editor.dispatchCommand(REDO_COMMAND, undefined); }} className={`${btn()} disabled:cursor-not-allowed disabled:opacity-30`} title="Redo (⌘Y)">
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* AI Assist Button */}
      <div className="relative z-40">
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            const next = !aiMenuOpen;
            closeAllMenus();
            setAiMenuOpen(next);
          }}
          className="h-7 px-2 flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-xs text-foreground font-medium transition-colors"
          title="AI Assist"
        >
          {loadingAiAction ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
          <span>AI Assist</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        {aiMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[150px] rounded-xl border border-border bg-card p-1 shadow-2xl animate-in fade-in zoom-in-95">
            <button onMouseDown={e => { e.preventDefault(); void handleAiOption('improve'); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-secondary transition-colors">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Improve
            </button>
            <button onMouseDown={e => { e.preventDefault(); void handleAiOption('rephrase'); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-secondary transition-colors">
              <RefreshCw className="h-3.5 w-3.5 text-blue-400" /> Rephrase
            </button>
            <button onMouseDown={e => { e.preventDefault(); void handleAiOption('summarize'); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-secondary transition-colors">
              <AlignLeft className="h-3.5 w-3.5 text-emerald-400" /> Summarize
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Font Family Dropdown */}
      <div className="relative z-40">
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            const next = !fontMenuOpen;
            closeAllMenus();
            setFontMenuOpen(next);
          }}
          className="h-7 px-2 flex items-center gap-1 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-xs text-foreground font-medium transition-colors"
          title="Font Family"
        >
          <Type className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{selectedFont}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        {fontMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-xl border border-border bg-card p-1 shadow-2xl animate-in fade-in zoom-in-95">
            {FONTS.map(f => (
              <button
                key={f.label}
                onMouseDown={e => { e.preventDefault(); applyFontFamily(f.label, f.value); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-secondary text-foreground transition-colors"
                style={{ fontFamily: f.value }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Block Style Dropdown */}
      <div className="relative z-40">
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            const next = !blockMenuOpen;
            closeAllMenus();
            setBlockMenuOpen(next);
          }}
          className="h-7 px-2 flex items-center gap-1 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-xs text-foreground font-medium transition-colors"
          title="Block Style"
        >
          <span>{selectedBlock}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        {blockMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-xl border border-border bg-card p-1 shadow-2xl animate-in fade-in zoom-in-95">
            {BLOCK_TYPES.map(b => (
              <button
                key={b.label}
                onMouseDown={e => { e.preventDefault(); applyBlockType(b.value, b.label); }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-secondary text-foreground transition-colors"
              >
                <span>{b.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{b.shortcut}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Size Selector: - 16 + */}
      <div className="flex items-center rounded-md border border-border bg-secondary/60 px-1 h-7">
        <button type="button" onMouseDown={e => { e.preventDefault(); changeFontSize(-1); }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-foreground">
          <Minus className="h-3 w-3" />
        </button>
        <span className="font-mono text-xs px-1.5 font-medium text-foreground">{fontSize}</span>
        <button type="button" onMouseDown={e => { e.preventDefault(); changeFontSize(1); }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-foreground">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Bold, Italic, Underline, Strikethrough, Code */}
      <button type="button" onMouseDown={e => { e.preventDefault(); format('bold'); }} className={btn()} title="Bold (⌘B)">
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); format('italic'); }} className={btn()} title="Italic (⌘I)">
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); format('underline'); }} className={btn()} title="Underline (⌘U)">
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); format('strikethrough'); }} className={btn()} title="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); format('code'); }} className={btn()} title="Inline code">
        <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Text Color Custom Picker */}
      <div className="relative z-40">
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            const next = !colorMenuOpen;
            closeAllMenus();
            setColorMenuOpen(next);
          }}
          className={btn()}
          title="Text Color"
        >
          <Type className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {colorMenuOpen && (
          <CustomColorPicker
            title="Text Color"
            currentColor="#000000"
            onSelectColor={color => setTextColor(color)}
            onClose={() => setColorMenuOpen(false)}
          />
        )}
      </div>

      {/* Background / Highlight Color Custom Picker */}
      <div className="relative z-40">
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            const next = !bgMenuOpen;
            closeAllMenus();
            setBgMenuOpen(next);
          }}
          className={btn()}
          title="Text Highlight / Background Color"
        >
          <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {bgMenuOpen && (
          <CustomColorPicker
            title="Highlight Color"
            currentColor="rgba(253, 224, 71, 0.35)"
            onSelectColor={color => setBgColor(color)}
            onClose={() => setBgMenuOpen(false)}
          />
        )}
      </div>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Alignment Controls */}
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left'); }} className={btn()} title="Align Left">
        <AlignLeft className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center'); }} className={btn()} title="Align Center">
        <AlignCenter className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right'); }} className={btn()} title="Align Right">
        <AlignRight className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify'); }} className={btn()} title="Justify">
        <AlignJustify className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Link Tool */}
      <div className="relative z-40">
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            const next = !linkInputOpen;
            closeAllMenus();
            setLinkInputOpen(next);
          }}
          className={btn()}
          title="Insert Link"
        >
          <Link className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {linkInputOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 flex items-center gap-1.5 p-2 rounded-xl border border-border bg-card shadow-2xl min-w-[220px]">
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') insertLink(); }}
              placeholder="https://example.com"
              className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-xs text-foreground outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={insertLink}
              className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-semibold"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Clear Text Button */}
      <button
        type="button"
        disabled={!hasContent}
        onMouseDown={e => {
          e.preventDefault();
          if (hasContent && onClearAll) onClearAll();
        }}
        className="h-7 px-2.5 flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 disabled:border-border disabled:bg-secondary/60 disabled:text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Clear text"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
}

/* ── Contextual Floating AI Selection Bubble ── */
function SelectionAIBubblePlugin({ onAiTransform }: { onAiTransform?: (action: string, selectedText: string) => Promise<string> }) {
  const [editor] = useLexicalComposerContext();
  const [selectedText, setSelectedText] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const updateSelection = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        const text = selection.getTextContent().trim();
        if (text.length > 2) {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelectedText(text);
            setPosition({
              top: Math.max(10, rect.top - 50),
              left: Math.max(20, rect.left + rect.width / 2 - 140),
            });
            return;
          }
        }
      }
      setSelectedText('');
      setPosition(null);
    });
  }, [editor]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateSelection);
    return () => document.removeEventListener('selectionchange', updateSelection);
  }, [updateSelection]);

  const handleAction = async (action: 'improve' | 'rephrase' | 'summarize' | 'explain' | 'flashcard') => {
    if (!selectedText || !onAiTransform) return;
    setLoadingAction(action);
    try {
      const transformed = await onAiTransform(action, selectedText);
      if (transformed) {
        const cleanText = normalizeAiOutput(transformed);
        const words = cleanText.split(/\s+/);
        if (words.length <= 2) {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(cleanText);
            }
          });
        } else {
          const chunkSize = Math.max(1, Math.ceil(words.length / 20));
          let currentIdx = chunkSize;
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(words.slice(0, chunkSize).join(' ') + ' ');
            }
          });

          await new Promise<void>((resolve) => {
            const interval = setInterval(() => {
              if (currentIdx >= words.length) {
                clearInterval(interval);
                resolve();
                return;
              }
              const nextWords = words.slice(currentIdx, currentIdx + chunkSize).join(' ');
              currentIdx += chunkSize;
              editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                  selection.insertText(nextWords + (currentIdx < words.length ? ' ' : ''));
                }
              });
            }, 30);
          });
        }
      }
    } catch (err) {
      console.error('AI selection action:', err);
    } finally {
      setLoadingAction(null);
      setSelectedText('');
      setPosition(null);
    }
  };

  if (!selectedText || !position) return null;

  return (
    <div
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      className="fixed z-50 flex items-center gap-1 p-1 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
    >
      <button
        onClick={() => void handleAction('improve')}
        disabled={loadingAction !== null}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        title="Improve writing style & grammar"
      >
        {loadingAction === 'improve' ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : <Sparkles className="w-3 h-3 text-primary" />}
        <span>Improve</span>
      </button>

      <button
        onClick={() => void handleAction('rephrase')}
        disabled={loadingAction !== null}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        title="Rephrase with better clarity"
      >
        {loadingAction === 'rephrase' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 text-blue-400" />}
        <span>Rephrase</span>
      </button>

      <button
        onClick={() => void handleAction('summarize')}
        disabled={loadingAction !== null}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        title="Summarize into key points"
      >
        {loadingAction === 'summarize' ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlignLeft className="w-3 h-3 text-emerald-400" />}
        <span>Summarize</span>
      </button>

      <button
        onClick={() => void handleAction('explain')}
        disabled={loadingAction !== null}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        title="Explain concept simply"
      >
        {loadingAction === 'explain' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3 text-purple-400" />}
        <span>Explain</span>
      </button>

      <button
        onClick={() => void handleAction('flashcard')}
        disabled={loadingAction !== null}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        title="Make flashcard Q&A"
      >
        {loadingAction === 'flashcard' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-orange-400" />}
        <span>Flashcard</span>
      </button>
    </div>
  );
}

/* ── HTML loader plugin ── */
function HtmlLoaderPlugin({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!html || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    editor.update(() => {
      const root = $getRoot();
      if (root.getTextContent().trim()) return;
      const parser = new DOMParser();
      const dom = parser.parseFromString(html, 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);
      root.clear();
      root.select();
      $insertNodes(nodes);
    });
  }, [editor, html]);
  return null;
}

/* ── HTML extractor plugin ── */
function HtmlExtractPlugin({ onChange, onHeadingsUpdate }: { onChange: (html: string) => void; onHeadingsUpdate?: (headings: OutlineHeading[]) => void }) {
  const [editor] = useLexicalComposerContext();
  return (
    <OnChangePlugin
      onChange={editorState => {
        editorState.read(() => {
          const html = $generateHtmlFromNodes(editor);
          onChange(html);

          // Extract headings for Minimap Outline
          if (onHeadingsUpdate) {
            const parser = new DOMParser();
            const dom = parser.parseFromString(html, 'text/html');
            const elements = getOutlineElements(dom);
            const list: OutlineHeading[] = [];
            elements.forEach((el, index) => {
              const text = getNormalizedElementText(el);
              if (text) {
                list.push({
                  id: `heading-${index}`,
                  text,
                  level: getOutlineLevel(el),
                });
              }
            });
            onHeadingsUpdate(list);
          }
        });
      }}
    />
  );
}

/* ── Clear All Plugin ── */
function ClearAllPlugin({ clearTrigger, onCleared }: { clearTrigger: number; onCleared: () => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (clearTrigger === 0) return;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
    });
    onCleared();
  }, [clearTrigger, editor, onCleared]);
  return null;
}

interface NoteEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
  onAiTransform?: (action: string, selectedText: string) => Promise<string>;
  onSave?: () => void;
  onClearAll?: () => void;
}

export default function NoteEditor({
  initialHtml,
  onChange,
  placeholder = 'Write your note here…',
  minHeight = 400,
  autoFocus = false,
  onAiTransform,
  onSave,
  onClearAll,
}: NoteEditorProps) {
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [railHovered, setRailHovered] = useState(false);
  const [railPopoverPosition, setRailPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [clearTrigger, setClearTrigger] = useState(0);
  const [hasEditorContent, setHasEditorContent] = useState(() => {
    return htmlToPlainText(initialHtml).trim().length > 0;
  });
  const railRef = useRef<HTMLElement>(null);

  const initialConfig = {
    namespace: 'NoteZEditor',
    theme,
    nodes: [HeadingNode, ListNode, ListItemNode, CodeNode, QuoteNode, LinkNode, TableNode, TableCellNode, TableRowNode],
    html: { import: preservedHtmlImport },
    onError(error: Error) { console.error('Lexical error:', error); },
  };

  const scrollToHeading = (index: number) => {
    const editorDom = document.querySelector('[aria-label="Note editor"]');
    if (!editorDom) return;
    const headingElements = getOutlineElements(editorDom);
    const target = headingElements[index];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const updateRailPopoverPosition = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    setRailPopoverPosition({
      top: rect.top + rect.height / 2,
      // Keep the card flush with the rail. The card is 16rem wide;
      // leaving the old 16px gap made the rail fire onMouseLeave
      // before the pointer could reach the outline.
      left: Math.max(8, rect.left - 256),
    });
  }, []);

  useEffect(() => {
    if (!railHovered) return;
    updateRailPopoverPosition();
    const update = () => updateRailPopoverPosition();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [railHovered, updateRailPopoverPosition]);

  const handleClearAllInstant = () => {
    setHasEditorContent(false);
    setClearTrigger(prev => prev + 1);
    onClearAll?.();
  };

  const handleHtmlChange = useCallback((html: string) => {
    const plainText = htmlToPlainText(html).trim();
    setHasEditorContent(plainText.length > 0);
    onChange(html);
  }, [onChange]);

  const handleCleared = useCallback(() => handleHtmlChange(''), [handleHtmlChange]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background relative">
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin
          onSave={onSave}
          onClearAll={handleClearAllInstant}
          hasContent={hasEditorContent}
          onAiTransform={onAiTransform}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden relative">
          {/* Main Content Editable Area with dedicated right gutter for Minimap Rail */}
          <div className="relative min-h-0 flex-1 bg-background overflow-y-auto" style={{ minHeight }}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="note-editor-content h-full min-h-full outline-none pl-4 md:pl-6 pr-16 md:pr-20 py-4 text-[13px] text-foreground leading-relaxed"
                  style={{ minHeight }}
                  aria-label="Note editor"
                />
              }
              placeholder={
                <div className="absolute top-4 left-4 md:left-6 text-[13px] leading-relaxed text-muted-foreground pointer-events-none select-none">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>

          {/* Floating Vertical Outline Rail & Hover Card */}
          <aside
            ref={railRef}
            onMouseEnter={() => setRailHovered(true)}
            onMouseLeave={() => { setRailHovered(false); setRailPopoverPosition(null); }}
            className="group absolute right-3 top-0 bottom-0 z-40 flex items-center pr-3 pl-4 cursor-pointer select-none"
          >
            {/* Resting Vertical Dash Indicators */}
            <div className="flex flex-col gap-2 py-4 items-end pointer-events-auto">
              {(headings.length > 0 ? headings : Array.from({ length: 14 })).map((h, i) => (
                <div
                  key={typeof h === 'object' ? h.id : i}
                  onClick={() => typeof h === 'object' && scrollToHeading(i)}
                  className={`h-0.5 rounded-full transition-all duration-150 ${
                    typeof h === 'object'
                      ? h.level === 1 ? 'w-5 bg-foreground/60 group-hover:bg-foreground' : h.level === 2 ? 'w-3.5 bg-muted-foreground/50 group-hover:bg-foreground/80' : 'w-2 bg-muted-foreground/30'
                      : 'w-4 bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            {/* Hover Popover Outline Card */}
            {railHovered && headings.length > 0 && railPopoverPosition && (
              <div
                style={{
                  top: `${railPopoverPosition.top}px`,
                  left: `${railPopoverPosition.left}px`,
                  transform: 'translateY(-50%)',
                }}
                className="fixed w-64 max-h-[75vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-2.5 z-50 text-foreground pointer-events-auto"
                onMouseEnter={() => setRailHovered(true)}
                onMouseLeave={() => { setRailHovered(false); setRailPopoverPosition(null); }}
              >
                <div className="space-y-1">
                  {headings.map((h, i) => (
                    <button
                      key={h.id}
                      onClick={() => scrollToHeading(i)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors truncate"
                    >
                      {h.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        <HistoryPlugin />
        <LinkPlugin />
        <ClickableLinkPlugin newTab={true} />
        {autoFocus && <AutoFocusPlugin />}
        <ListPlugin />
        <HtmlLoaderPlugin html={initialHtml} />
        <HtmlExtractPlugin onChange={handleHtmlChange} onHeadingsUpdate={setHeadings} />
        <ClearAllPlugin clearTrigger={clearTrigger} onCleared={handleCleared} />
      </LexicalComposer>
    </div>
  );
}
