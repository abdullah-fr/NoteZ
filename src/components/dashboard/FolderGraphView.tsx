import { useMemo, useState } from 'react';
import { Maximize2, Search, ZoomIn, ZoomOut } from 'lucide-react';

interface Note { id: string; title: string }
interface Section { id: string; name: string; notes: Note[] }
interface FolderItem { id: string; name: string; color: string; categories: Section[] }

interface Props {
  folders: FolderItem[];
  onSelectFolder: (folderId: string) => void;
  onSelectSection: (folderId: string, sectionId: string) => void;
  onSelectNote: (folderId: string, sectionId: string, noteId: string) => void;
}

function truncate(value: string, max = 20) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function matches(value: string, query: string) {
  return !query || value.toLowerCase().includes(query.toLowerCase());
}

export default function FolderGraphView({ folders, onSelectFolder, onSelectSection, onSelectNote }: Props) {
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const layout = useMemo(() => {
    const columns = folders.length <= 2 ? folders.length : folders.length <= 8 ? 3 : 4;
    const cardWidth = 320;
    const columnGap = 24;
    const rowGap = 24;
    const cardLayouts = folders.map(folder => {
      const contentHeight = folder.categories.reduce((total, section) => total + 40 + Math.max(1, section.notes.length) * 23, 0);
      return { folder, width: cardWidth, height: Math.max(126, 72 + contentHeight) };
    });
    const rowHeights: number[] = [];
    cardLayouts.forEach((card, index) => {
      const row = Math.floor(index / columns);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, card.height);
    });
    const rowTops: number[] = [];
    rowHeights.forEach((height, index) => {
      rowTops[index] = index === 0 ? 24 : rowTops[index - 1] + rowHeights[index - 1] + rowGap;
    });
    return {
      cards: cardLayouts.map((card, index) => ({
        ...card,
        x: 24 + (index % columns) * (cardWidth + columnGap),
        y: rowTops[Math.floor(index / columns)],
      })),
      width: Math.max(680, 48 + columns * cardWidth + (columns - 1) * columnGap),
      height: Math.max(180, (rowTops[rowTops.length - 1] ?? 24) + (rowHeights[rowHeights.length - 1] ?? 126) + 24),
    };
  }, [folders]);

  if (folders.length === 0) {
    return <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-border bg-card text-center"><p className="text-sm text-muted-foreground">Create a folder to start your study map.</p></div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card/80 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/60 p-3">
        <div className="relative min-w-[140px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a folder, section, or note…" className="w-full rounded-lg border border-border bg-secondary/60 py-2 pl-8 pr-3 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1 shrink-0">
          <button onClick={() => setZoom(value => Math.max(0.7, Number((value - 0.1).toFixed(2))))} aria-label="Zoom out" className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="min-w-[42px] text-center text-[10px] font-mono text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(value => Math.min(1.5, Number((value + 0.1).toFixed(2))))} aria-label="Zoom in" className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"><ZoomIn className="h-3.5 w-3.5" /></button>
          <button onClick={() => setZoom(1)} aria-label="Reset graph zoom" className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"><Maximize2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="max-h-[min(70vh,760px)] overflow-auto p-3 touch-pan-x touch-pan-y">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width * zoom}
          height={layout.height * zoom}
          role="img"
          aria-label="Folder, section, and note study map"
          className="block max-w-none"
        >
          {layout.cards.map(({ folder, x, y, width, height }) => {
            const folderMatches = matches(folder.name, query) || folder.categories.some(section => matches(section.name, query) || section.notes.some(note => matches(note.title, query)));
            const folderId = `folder-${folder.id}`;
            return (
              <g key={folder.id} opacity={query && !folderMatches ? 0.2 : 1}>
                <rect x={x} y={y} width={width} height={height} rx="16" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
                <line x1={x + 18} y1={y + 52} x2={x + width - 18} y2={y + 52} stroke="hsl(var(--border))" strokeWidth="1" />
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectFolder(folder.id)}
                  onMouseEnter={() => setHovered(folderId)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle cx={x + 28} cy={y + 27} r={hovered === folderId ? 11 : 9} fill={hovered === folderId ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} stroke="hsl(var(--primary) / 0.45)" />
                  <text x={x + 48} y={y + 31} fontSize="12" fontWeight="700" fill="hsl(var(--foreground))">{truncate(folder.name)}</text>
                  <text x={x + width - 18} y={y + 31} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{folder.categories.length} section{folder.categories.length === 1 ? '' : 's'}</text>
                </g>
                {folder.categories.length === 0 && <text x={x + 18} y={y + 78} fontSize="10" fill="hsl(var(--muted-foreground))">Empty folder</text>}
                {folder.categories.map((section, sectionIndex) => {
                  const sectionY = y + 77 + folder.categories.slice(0, sectionIndex).reduce((total, item) => total + 40 + Math.max(1, item.notes.length) * 23, 0);
                  const sectionId = `section-${section.id}`;
                  return (
                    <g key={section.id}>
                      <line x1={x + 28} y1={y + 52} x2={x + 28} y2={sectionY - 12} stroke="hsl(var(--border))" strokeWidth="1" />
                      <g className="cursor-pointer" onClick={() => onSelectSection(folder.id, section.id)} onMouseEnter={() => setHovered(sectionId)} onMouseLeave={() => setHovered(null)}>
                        <circle cx={x + 28} cy={sectionY} r={hovered === sectionId ? 8 : 6} fill={hovered === sectionId ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} stroke="hsl(var(--border))" />
                        <text x={x + 43} y={sectionY + 3} fontSize="10" fontWeight="600" fill="hsl(var(--foreground))">{truncate(section.name)}</text>
                      </g>
                      {section.notes.length === 0 && <text x={x + 43} y={sectionY + 25} fontSize="9" fill="hsl(var(--muted-foreground))">No notes yet</text>}
                      {section.notes.map((note, noteIndex) => {
                        const noteY = sectionY + 24 + noteIndex * 23;
                        const noteId = `note-${note.id}`;
                        return (
                          <g key={note.id} className="cursor-pointer" onClick={() => onSelectNote(folder.id, section.id, note.id)} onMouseEnter={() => setHovered(noteId)} onMouseLeave={() => setHovered(null)}>
                            <line x1={x + 28} y1={sectionY + 8} x2={x + 49} y2={noteY} stroke="hsl(var(--border))" strokeWidth="1" />
                            <circle cx={x + 55} cy={noteY} r={hovered === noteId ? 5 : 4} fill={hovered === noteId ? 'hsl(var(--primary))' : 'hsl(var(--muted))'} stroke="hsl(var(--border))" />
                            <text x={x + 66} y={noteY + 3} fontSize="9" fill="hsl(var(--muted-foreground))">{truncate(note.title)}</text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-[10px] font-mono text-muted-foreground">
        <span>{folders.length} folders · Click a node to open it</span>
        <span className="hidden sm:inline">Search to spotlight connected study areas</span>
      </div>
    </div>
  );
}
