import JSZip from 'jszip';
import mammoth from 'mammoth';

const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

type SourceRunStyle = {
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSizePt?: number;
  underline?: boolean;
};

type SourceParagraphStyle = {
  text: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  indentStartTwips?: number;
  firstLineTwips?: number;
  hangingTwips?: number;
  spaceBeforeTwips?: number;
  spaceAfterTwips?: number;
  line?: number;
  lineRule?: string;
};

type DocxFormatting = {
  runs: SourceRunStyle[];
  paragraphs: SourceParagraphStyle[];
};

type MammothElement = {
  type?: string;
  children?: MammothElement[];
  [key: string]: unknown;
};

const WORD_HIGHLIGHTS: Record<string, string> = {
  black: '#000000',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  darkBlue: '#1e3a8a',
  darkCyan: '#155e75',
  darkGray: '#4b5563',
  darkGreen: '#166534',
  darkMagenta: '#86198f',
  darkRed: '#991b1b',
  darkYellow: '#a16207',
  green: '#22c55e',
  lightGray: '#d1d5db',
  magenta: '#d946ef',
  red: '#ef4444',
  white: '#ffffff',
  yellow: '#fde047',
};

const WORD_THEME_COLORS: Record<string, string> = {
  dark1: '#000000',
  dark2: '#44546a',
  light1: '#ffffff',
  light2: '#e7e6e6',
  accent1: '#4472c4',
  accent2: '#ed7d31',
  accent3: '#a5a5a5',
  accent4: '#ffc000',
  accent5: '#5b9bd5',
  accent6: '#70ad47',
  hlink: '#0563c1',
  folHlink: '#954f72',
};

const EDITOR_CLASS_STYLES: Record<string, Record<string, string>> = {
  'text-foreground': { color: '#1f2937' },
  'text-foreground/90': { color: '#374151' },
  'text-muted-foreground': { color: '#6b7280' },
  'text-blue-500': { color: '#3b82f6' },
  'text-blue-600': { color: '#2563eb' },
  'text-emerald-400': { color: '#34d399' },
  'text-[13px]': { 'font-size': '13px' },
  'text-[12px]': { 'font-size': '12px' },
  'text-base': { 'font-size': '16px' },
  'text-xl': { 'font-size': '20px' },
  'font-serif': { 'font-family': 'Georgia, "Times New Roman", serif' },
  'font-mono': { 'font-family': '"Courier New", monospace' },
  'font-bold': { 'font-weight': '700' },
  'font-semibold': { 'font-weight': '600' },
  italic: { 'font-style': 'italic' },
  underline: { 'text-decoration-line': 'underline' },
  'underline-offset-2': { 'text-underline-offset': '2px' },
  'underline-offset-4': { 'text-underline-offset': '4px' },
  'line-through': { 'text-decoration-line': 'line-through' },
  'leading-relaxed': { 'line-height': '1.625' },
  'list-disc': { 'list-style-type': 'disc' },
  'list-decimal': { 'list-style-type': 'decimal' },
  'pl-5': { 'padding-left': '1.25rem' },
  'my-1': { 'margin-top': '0.25rem', 'margin-bottom': '0.25rem' },
  'my-1.5': { 'margin-top': '0.375rem', 'margin-bottom': '0.375rem' },
  'mt-4': { 'margin-top': '1rem' },
  'mt-3': { 'margin-top': '0.75rem' },
  'mt-2': { 'margin-top': '0.5rem' },
  'mb-2': { 'margin-bottom': '0.5rem' },
  'mb-1.5': { 'margin-bottom': '0.375rem' },
  'mb-1': { 'margin-bottom': '0.25rem' },
  'note-editor-table': {
    width: '100%',
    'margin-top': '0.75rem',
    'margin-bottom': '0.75rem',
    'border-collapse': 'collapse',
    'font-size': '13px',
  },
  'note-editor-table-cell': {
    border: '1px solid #d1d5db',
    padding: '0.4rem 0.55rem',
    'vertical-align': 'top',
    'text-align': 'start',
  },
  'note-editor-table-cell-header': {
    'background-color': '#e5e7eb',
    'font-weight': '600',
  },
};

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'table', 'tr', 'td', 'th']);

function getWordElements(parent: Document | Element, localName: string): Element[] {
  const namespaced = parent.getElementsByTagNameNS(WORD_NAMESPACE, localName);
  if (namespaced.length > 0) return Array.from(namespaced);
  return Array.from(parent.getElementsByTagName(`w:${localName}`));
}

function getWordAttribute(element: Element | undefined, name: string): string {
  if (!element) return '';
  return element.getAttributeNS(WORD_NAMESPACE, name)
    || element.getAttribute(`w:${name}`)
    || element.getAttribute(name)
    || '';
}

function getFirstWordElement(parent: Document | Element | undefined, localName: string): Element | undefined {
  if (!parent) return undefined;
  return getWordElements(parent, localName)[0];
}

function parseNumber(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeColor(value: string): string | undefined {
  if (/^[0-9a-f]{6}$/i.test(value)) return `#${value}`;
  if (/^[0-9a-f]{3}$/i.test(value)) return `#${value}`;
  return WORD_THEME_COLORS[value] || undefined;
}

function readRunStyle(run: Element): SourceRunStyle {
  const properties = getFirstWordElement(run, 'rPr');
  const colorElement = getFirstWordElement(properties, 'color');
  const highlightElement = getFirstWordElement(properties, 'highlight');
  const fonts = getFirstWordElement(properties, 'rFonts');
  const size = getFirstWordElement(properties, 'sz');
  const underlineElement = getFirstWordElement(properties, 'u');
  const colorValue = getWordAttribute(colorElement, 'val');
  const themeColor = getWordAttribute(colorElement, 'themeColor');
  const highlight = getWordAttribute(highlightElement, 'val');
  const sizeValue = parseNumber(getWordAttribute(size, 'val'));
  const underlineValue = getWordAttribute(underlineElement, 'val');

  return {
    color: normalizeColor(colorValue) || normalizeColor(themeColor),
    backgroundColor: WORD_HIGHLIGHTS[highlight],
    fontFamily: getWordAttribute(fonts, 'ascii')
      || getWordAttribute(fonts, 'hAnsi')
      || getWordAttribute(fonts, 'eastAsia')
      || undefined,
    fontSizePt: sizeValue ? sizeValue / 2 : undefined,
    underline: Boolean(underlineElement && underlineValue !== 'none'),
  };
}

function paragraphText(paragraph: Element): string {
  let text = '';
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.parentElement?.localName === 't') {
      text += node.nodeValue || '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element.localName === 'tab') {
      text += '\t';
      return;
    }
    if (element.localName === 'br' || element.localName === 'cr') {
      text += '\n';
      return;
    }
    Array.from(element.childNodes).forEach(visit);
  };
  Array.from(paragraph.childNodes).forEach(visit);
  return text;
}

function paragraphAlignment(value: string): SourceParagraphStyle['alignment'] {
  if (value === 'center') return 'center';
  if (value === 'right') return 'right';
  if (value === 'both' || value === 'distribute' || value === 'mediumKashida' || value === 'highKashida') return 'justify';
  if (value === 'left' || value === 'start') return 'left';
  return undefined;
}

function readParagraphStyle(paragraph: Element): SourceParagraphStyle {
  const properties = getFirstWordElement(paragraph, 'pPr');
  const indentation = getFirstWordElement(properties, 'ind');
  const spacing = getFirstWordElement(properties, 'spacing');
  const left = parseNumber(getWordAttribute(indentation, 'left') || getWordAttribute(indentation, 'start'));
  const firstLine = parseNumber(getWordAttribute(indentation, 'firstLine'));
  const hanging = parseNumber(getWordAttribute(indentation, 'hanging'));
  const before = parseNumber(getWordAttribute(spacing, 'before'));
  const after = parseNumber(getWordAttribute(spacing, 'after'));
  const line = parseNumber(getWordAttribute(spacing, 'line'));

  return {
    text: paragraphText(paragraph),
    alignment: paragraphAlignment(getWordAttribute(getFirstWordElement(properties, 'jc'), 'val')),
    indentStartTwips: left,
    firstLineTwips: firstLine,
    hangingTwips: hanging,
    spaceBeforeTwips: before,
    spaceAfterTwips: after,
    line,
    lineRule: getWordAttribute(spacing, 'lineRule') || undefined,
  };
}

function readDocxFormatting(xml: string): DocxFormatting {
  const xmlDocument = new DOMParser().parseFromString(xml, 'application/xml');
  if (xmlDocument.querySelector('parsererror')) return { runs: [], paragraphs: [] };
  return {
    runs: getWordElements(xmlDocument, 'r').map(readRunStyle),
    paragraphs: getWordElements(xmlDocument, 'p').map(readParagraphStyle),
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function directBlockText(element: Element): string {
  let text = '';
  Array.from(element.childNodes).forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.nodeValue || '';
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const childElement = child as Element;
    if (BLOCK_TAGS.has(childElement.tagName.toLowerCase())) return;
    text += childElement.textContent || '';
  });
  return normalizeText(text);
}

function applyRunStyle(element: HTMLElement, style: SourceRunStyle): void {
  if (style.color) element.style.setProperty('color', style.color);
  if (style.backgroundColor) element.style.setProperty('background-color', style.backgroundColor);
  if (style.fontFamily) element.style.setProperty('font-family', style.fontFamily);
  if (style.fontSizePt) element.style.setProperty('font-size', `${style.fontSizePt}pt`);
  if (style.underline) element.style.setProperty('text-decoration-line', 'underline');
}

function twipsToPixels(value: number): string {
  return `${Math.round((value / 15) * 100) / 100}px`;
}

function applyParagraphStyle(element: HTMLElement, style: SourceParagraphStyle): void {
  if (style.alignment) element.style.textAlign = style.alignment;
  if (style.indentStartTwips) element.style.paddingInlineStart = twipsToPixels(style.indentStartTwips);
  if (style.firstLineTwips || style.hangingTwips) {
    const textIndent = (style.firstLineTwips || 0) - (style.hangingTwips || 0);
    element.style.textIndent = twipsToPixels(textIndent);
  }
  if (style.spaceBeforeTwips !== undefined) element.style.marginTop = twipsToPixels(style.spaceBeforeTwips);
  if (style.spaceAfterTwips !== undefined) element.style.marginBottom = twipsToPixels(style.spaceAfterTwips);
  if (style.line) {
    if (style.lineRule === 'auto' || !style.lineRule) {
      element.style.lineHeight = String(style.line / 240);
    } else {
      element.style.lineHeight = `${style.line / 20}pt`;
    }
  }
}

function decorateConvertedHtml(html: string, formatting: DocxFormatting): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const body = parsed.body;
  // Notes are text-editor content: preserve the text and its formatting, not embedded source images.
  body.querySelectorAll('img').forEach(element => element.remove());
  const markedRuns = Array.from(body.querySelectorAll('span[class*="notez-run-"]')) as HTMLElement[];

  markedRuns.forEach(element => {
    const marker = Array.from(element.classList).find(className => /^notez-run-\d+$/.test(className));
    const index = marker ? Number.parseInt(marker.replace('notez-run-', ''), 10) : -1;
    if (index >= 0 && formatting.runs[index]) applyRunStyle(element, formatting.runs[index]);
    if (marker) element.classList.remove(marker);
    if (element.classList.length === 0) element.removeAttribute('class');
  });

  const sourceParagraphs = formatting.paragraphs.filter(paragraph => normalizeText(paragraph.text) || paragraph.text.includes('\n'));
  const blocks = Array.from(body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')) as HTMLElement[];
  let sourceIndex = 0;

  blocks.forEach(block => {
    const text = directBlockText(block);
    if (!text) return;
    let match = -1;
    for (let index = sourceIndex; index < sourceParagraphs.length; index += 1) {
      if (normalizeText(sourceParagraphs[index].text) === text) {
        match = index;
        break;
      }
    }
    if (match < 0) return;
    applyParagraphStyle(block, sourceParagraphs[match]);
    sourceIndex = match + 1;
  });

  return body.innerHTML;
}

function markerStyleMap(runCount: number): string[] {
  return Array.from({ length: runCount }, (_, index) => (
    `r[style-name='NoteZRun${index}'] => span.notez-run-${index}`
  ));
}

function markMammothRuns(element: MammothElement, nextRun: { value: number }): MammothElement {
  const transformed = element.children
    ? { ...element, children: element.children.map(child => markMammothRuns(child, nextRun)) }
    : element;
  if (transformed.type !== 'run') return transformed;

  const index = nextRun.value;
  nextRun.value += 1;
  const marker = `NoteZRun${index}`;
  return { ...transformed, styleId: marker, styleName: marker };
}

export async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentFile = zip.file('word/document.xml');
  const documentXml = documentFile ? await documentFile.async('string') : '';
  const formatting = readDocxFormatting(documentXml);
  const nextRun = { value: 0 };

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [...markerStyleMap(formatting.runs.length), 'u => u'],
      transformDocument: element => markMammothRuns(element as MammothElement, nextRun),
    },
  );

  return decorateConvertedHtml(result.value, formatting);
}

function applyKnownClassStyles(element: HTMLElement): void {
  Array.from(element.classList).forEach(className => {
    const styles = EDITOR_CLASS_STYLES[className];
    if (!styles) return;
    Object.entries(styles).forEach(([property, value]) => {
      if (!element.style.getPropertyValue(property)) element.style.setProperty(property, value);
    });
  });
  element.removeAttribute('class');
}

function sanitizeHtmlTree(root: HTMLElement): void {
  root.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(element => element.remove());
  root.querySelectorAll('*').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name);
      if (attribute.name === 'href' || attribute.name === 'src') {
        try {
          const url = new URL(attribute.value, document.baseURI);
          const allowed = url.protocol === 'http:' || url.protocol === 'https:' ||
            (attribute.name === 'href' && url.protocol === 'mailto:');
          if (!allowed) element.removeAttribute(attribute.name);
        } catch {
          element.removeAttribute(attribute.name);
        }
      }
      if (attribute.name === 'style') {
        element.setAttribute('style', attribute.value.replace(/expression\s*\([^)]*\)|url\s*\(\s*["']?javascript:[^)]*\)/gi, ''));
      }
    });
    applyKnownClassStyles(element as HTMLElement);
  });
}

export function htmlDocumentToNoteHtml(source: string): string | null {
  if (!/<(?:!doctype\s+html|html|body|p|div|span|strong|u|table)\b/i.test(source)) return null;
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  if (!parsed.body) return null;
  sanitizeHtmlTree(parsed.body);
  parsed.body.querySelectorAll('img').forEach(element => element.remove());
  return parsed.body.innerHTML.trim() || null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

export function buildWordHtmlDocument(title: string, content: string): string {
  const parsed = document.implementation.createHTMLDocument(title || 'NoteZ Note');
  parsed.body.innerHTML = content || '<p></p>';
  sanitizeHtmlTree(parsed.body);

  parsed.querySelectorAll('table').forEach(table => {
    const element = table as HTMLElement;
    element.style.borderCollapse = 'collapse';
    element.style.width = element.style.width || '100%';
  });
  parsed.querySelectorAll('th, td').forEach(cell => {
    const element = cell as HTMLElement;
    element.style.border = element.style.border || '1px solid #d1d5db';
    element.style.padding = element.style.padding || '6px 8px';
    element.style.verticalAlign = element.style.verticalAlign || 'top';
  });
  parsed.querySelectorAll('img').forEach(image => {
    const element = image as HTMLElement;
    element.style.maxWidth = element.style.maxWidth || '100%';
    element.style.height = element.style.height || 'auto';
  });

  const portableStyles = `
    @page { margin: 1in; }
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.6; }
    h1, h2, h3, h4, h5, h6 { font-family: Georgia, "Times New Roman", serif; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; }
    th, td { vertical-align: top; }
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || 'NoteZ Note')}</title><style>${portableStyles}</style></head><body>${parsed.body.innerHTML}</body></html>`;
}
