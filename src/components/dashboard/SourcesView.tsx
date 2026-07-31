import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import {
  fetchSources,
  uploadSourceFile,
  createUrlSource,
  createPastedSource,
  deleteSource,
  triggerProcessSource,
  generateFromSource,
  subscribeToSourceChanges,
  type Source,
  type SourceKind,
} from '@/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Upload, Link2, Youtube, FileText, Loader2, Sparkles, Trash2,
  CheckCircle2, AlertCircle, Layers, Brain, NotebookPen, RefreshCw, FileUp
} from 'lucide-react';

const kindMeta: Record<SourceKind, { icon: any; label: string; tone: string }> = {
  pdf:     { icon: FileText,    label: 'PDF',     tone: 'text-rose-400' },
  docx:    { icon: FileText,    label: 'DOCX',    tone: 'text-sky-400' },
  txt:     { icon: FileText,    label: 'Text',    tone: 'text-emerald-400' },
  url:     { icon: Link2,       label: 'Web',     tone: 'text-violet-400' },
  youtube: { icon: Youtube,     label: 'YouTube', tone: 'text-red-500' },
  text:    { icon: NotebookPen, label: 'Pasted',  tone: 'text-amber-400' },
};

export default function SourcesView() {
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  // Forms
  const [urlInput, setUrlInput] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    void fetchSourcesData();
    return subscribeToSourceChanges(user.id, fetchSourcesData);
  }, [user]);

  const fetchSourcesData = async () => {
    const data = await fetchSources();
    setSources(data);
    setLoading(false);
  };

  const triggerProcess = async (sourceId: string) => {
    setBusyId(sourceId);
    try {
      await triggerProcessSource(sourceId);
    } catch (e: any) {
      toast({ title: 'Processing failed', description: e.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    const file = files[0];
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 20MB per upload.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const row = await uploadSourceFile(user.id, file);
      toast({ title: 'Uploaded', description: 'Processing in the background…' });
      void triggerProcess(row.id);
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addUrl = async () => {
    if (!urlInput.trim() || !user) return;
    try { new URL(urlInput); } catch {
      toast({ title: 'Invalid URL', variant: 'destructive' }); return;
    }
    const row = await createUrlSource(user.id, urlInput);
    setUrlInput('');
    void triggerProcess(row.id);
  };

  const addPasted = async () => {
    if (!pasteContent.trim() || !user) return;
    const row = await createPastedSource(user.id, pasteTitle, pasteContent);
    setPasteTitle(''); setPasteContent('');
    void triggerProcess(row.id);
  };

  const generate = async (sourceId: string, mode: 'notes' | 'flashcards' | 'quiz') => {
    setGenerating(`${sourceId}:${mode}`);
    try {
      const data = await generateFromSource(sourceId, mode);
      const label = mode === 'notes' ? 'Notes saved' : mode === 'flashcards' ? `${data?.count ?? ''} flashcards added` : `${data?.count ?? ''} quiz questions saved`;
      toast({ title: 'Generated ✨', description: label });
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const remove = async (s: Source) => {
    if (!confirm(`Delete "${s.title}"?`)) return;
    try {
      await deleteSource(s);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" /> Sources
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload PDFs, docs, paste text or links. Turn any source into notes, flashcards or quizzes.
        </p>
      </div>

      {/* Add source */}
      <div className="glass rounded-2xl p-4 md:p-6">
        <Tabs defaultValue="upload">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="upload"><FileUp className="h-4 w-4 mr-2" />Upload</TabsTrigger>
            <TabsTrigger value="link"><Link2 className="h-4 w-4 mr-2" />Link</TabsTrigger>
            <TabsTrigger value="paste"><NotebookPen className="h-4 w-4 mr-2" />Paste</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 md:p-10 text-center transition-all ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/50 hover:bg-muted/20'
              }`}
            >
              <input
                ref={fileRef} type="file" className="hidden"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Uploading…</p></div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><Upload className="h-6 w-6 text-primary" /></div>
                  <p className="font-medium">Drop a file or click to upload</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD · up to 20MB</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="link" className="mt-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://… or YouTube link"
                className="bg-muted/30 border-border/50"
                onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              />
              <Button onClick={addUrl} disabled={!urlInput.trim()}><Sparkles className="h-4 w-4 mr-2" />Add</Button>
            </div>
            <p className="text-xs text-muted-foreground">We'll fetch the page (or video metadata) and summarize it.</p>
          </TabsContent>

          <TabsContent value="paste" className="mt-4 space-y-3">
            <Input
              value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Title (optional)"
              className="bg-muted/30 border-border/50"
            />
            <Textarea
              value={pasteContent} onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste your notes, lecture transcript, article…"
              className="bg-muted/30 border-border/50 min-h-[160px]"
            />
            <div className="flex justify-end">
              <Button onClick={addPasted} disabled={!pasteContent.trim()}><Sparkles className="h-4 w-4 mr-2" />Add source</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Library */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Library</h3>
          <span className="text-xs text-muted-foreground">{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>
        </div>

        {loading ? (
          <div className="glass rounded-xl p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : sources.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center text-muted-foreground">
            <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No sources yet. Add one above to get started.
          </div>
        ) : (
          <AnimatePresence>
            {sources.map((s) => {
              const Meta = kindMeta[s.kind];
              const Icon = Meta.icon;
              return (
                <motion.div
                  key={s.id}
                  layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="glass rounded-xl p-4 md:p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center ${Meta.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px]">{Meta.label}</Badge>
                            {s.status === 'processing' && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing…</span>}
                            {s.status === 'ready' && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Ready</span>}
                            {s.status === 'failed' && <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{s.error || 'Failed'}</span>}
                            {s.status === 'pending' && <span className="text-xs text-muted-foreground">Pending</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {(s.status === 'failed' || s.status === 'pending') && (
                            <Button size="icon" variant="ghost" onClick={() => triggerProcess(s.id)} disabled={busyId === s.id} aria-label="Retry">
                              {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => remove(s)} aria-label="Delete">
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {s.summary && (
                        <p className="mt-3 text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">{s.summary}</p>
                      )}

                      {s.status === 'ready' && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => generate(s.id, 'notes')} disabled={!!generating}>
                            {generating === `${s.id}:notes` ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5 mr-1.5" />}
                            Generate Notes
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => generate(s.id, 'flashcards')} disabled={!!generating}>
                            {generating === `${s.id}:flashcards` ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Layers className="h-3.5 w-3.5 mr-1.5" />}
                            Flashcards
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => generate(s.id, 'quiz')} disabled={!!generating}>
                            {generating === `${s.id}:quiz` ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Brain className="h-3.5 w-3.5 mr-1.5" />}
                            Quiz
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}