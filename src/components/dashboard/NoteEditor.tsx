/**
 * NoteEditor — Lexical-based rich text editor for NoteZ notes.
 *
 * Toolbar: Bold · Italic · Underline | H1 · H2 | Bullet list · Numbered list | Code block
 * All styling matches the existing dark design system.
 * Content is serialized to/from HTML for localStorage persistence.
 */
import { useEffect, useState } from 'react';
import {
  LexicalComposer,
} from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import {
  $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND,
  $createParagraphNode, COMMAND_PRIORITY_NORMAL, UNDO_COMMAND, REDO_COMMAND,
  CAN_UNDO_COMMAND, CAN_REDO_COMMAND,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, HeadingNode, $isHeadingNode } from '@lexical/rich-text';
import {
  INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND,
  ListNode, ListItemNode,
} from '@lexical/list';
import { CodeNode, $createCodeNode } from '@lexical/code';
import {
  $generateHtmlFromNodes, $generateNodesFromDOM,
} from '@lexical/html';
import { $getRoot, $insertNodes } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import {
  Bold, Italic, Underline, Heading1, Heading2,
  List, ListOrdered, Code,
  Undo2, Redo2,
} from 'lucide-react';

/* ── theme ── */
const theme = {
  heading: {
    h1: 'text-xl font-serif font-semibold text-foreground mt-4 mb-2',
    h2: 'text-base font-serif font-semibold text-foreground mt-3 mb-1.5',
  },
  text: {
    bold:       'font-bold',
    italic:     'italic',
    underline:  'underline',
    code:       'font-mono text-[12px] bg-secondary px-1.5 py-0.5 rounded text-[hsl(var(--foreground))]',
  },
  list: {
    ul: 'list-disc pl-5 my-1.5 space-y-0.5',
    ol: 'list-decimal pl-5 my-1.5 space-y-0.5',
    listitem: 'text-[13px] text-foreground',
  },
  code: 'block font-mono text-[12px] bg-secondary border border-border rounded-lg p-3 my-2 text-[hsl(var(--foreground))] whitespace-pre-wrap',
  paragraph: 'text-[13px] leading-relaxed text-foreground my-1 min-h-[1.5em]',
};

/* ── toolbar plugin ── */
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => mergeRegister(
    editor.registerCommand(CAN_UNDO_COMMAND, value => { setCanUndo(value); return false; }, COMMAND_PRIORITY_NORMAL),
    editor.registerCommand(CAN_REDO_COMMAND, value => { setCanRedo(value); return false; }, COMMAND_PRIORITY_NORMAL),
  ), [editor]);

  const btn = (active = false) =>
    `h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
      active
        ? 'bg-secondary text-foreground'
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
    }`;

  const format = (type: 'bold' | 'italic' | 'underline') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  };

  const setHeading = (tag: 'h1' | 'h2' | null) => {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      if (tag) {
        $setBlocksType(sel, () => $createHeadingNode(tag));
      } else {
        $setBlocksType(sel, () => $createParagraphNode());
      }
    });
  };

  const setCode = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createCodeNode());
    });
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border flex-wrap">
      <button type="button" disabled={!canUndo} onMouseDown={e => { e.preventDefault(); if (canUndo) editor.dispatchCommand(UNDO_COMMAND, undefined); }} className={`${btn()} disabled:cursor-not-allowed disabled:opacity-30`} title="Undo">
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button type="button" disabled={!canRedo} onMouseDown={e => { e.preventDefault(); if (canRedo) editor.dispatchCommand(REDO_COMMAND, undefined); }} className={`${btn()} disabled:cursor-not-allowed disabled:opacity-30`} title="Redo">
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-secondary mx-1" />

      <button type="button" onMouseDown={e => { e.preventDefault(); format('bold'); }}
        className={btn()} title="Bold (⌘B)">
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); format('italic'); }}
        className={btn()} title="Italic (⌘I)">
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); format('underline'); }}
        className={btn()} title="Underline (⌘U)">
        <Underline className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-secondary mx-1" />

      <button type="button" onMouseDown={e => { e.preventDefault(); setHeading('h1'); }}
        className={btn()} title="Heading 1">
        <Heading1 className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); setHeading('h2'); }}
        className={btn()} title="Heading 2">
        <Heading2 className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-secondary mx-1" />

      <button type="button"
        onMouseDown={e => { e.preventDefault(); editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined); }}
        className={btn()} title="Bullet list">
        <List className="h-3.5 w-3.5" />
      </button>
      <button type="button"
        onMouseDown={e => { e.preventDefault(); editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined); }}
        className={btn()} title="Numbered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); setCode(); }} className={btn()} title="Code block">
        <Code className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ── html loader plugin — populates editor with existing HTML content ── */
function HtmlLoaderPlugin({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!html) return;
    editor.update(() => {
      const root = $getRoot();
      if (root.getTextContent().trim()) return; // don't overwrite existing content
      const parser = new DOMParser();
      const dom = parser.parseFromString(html, 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);
      root.clear();
      root.select();
      $insertNodes(nodes);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/* ── html extractor plugin ── */
function HtmlExtractPlugin({ onChange }: { onChange: (html: string) => void }) {
  const [editor] = useLexicalComposerContext();
  return (
    <OnChangePlugin
      onChange={editorState => {
        editorState.read(() => {
          const html = $generateHtmlFromNodes(editor);
          onChange(html);
        });
      }}
    />
  );
}

/* ── main export ── */
interface NoteEditorProps {
  /** Initial HTML content (empty string for new notes) */
  initialHtml: string;
  /** Called on every content change with updated HTML */
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
}

export default function NoteEditor({
  initialHtml,
  onChange,
  placeholder = 'Write your note here…',
  minHeight = 220,
  autoFocus = false,
}: NoteEditorProps) {
  const initialConfig = {
    namespace: 'NoteEditor',
    theme,
    nodes: [HeadingNode, ListNode, ListItemNode, CodeNode],
    onError(error: Error) { console.error('Lexical error:', error); },
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background transition-colors">
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin />
        <div className="relative min-h-0 flex-1 bg-background" style={{ minHeight }}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="h-full min-h-full outline-none px-4 py-3 text-[13px] text-foreground leading-relaxed"
                style={{ minHeight }}
                aria-label="Note editor"
              />
            }
            placeholder={
              <div className="absolute top-3 left-4 text-[13px] text-muted-foreground pointer-events-none select-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        {autoFocus && <AutoFocusPlugin />}
        <ListPlugin />
        <HtmlLoaderPlugin html={initialHtml} />
        <HtmlExtractPlugin onChange={onChange} />
      </LexicalComposer>
    </div>
  );
}
