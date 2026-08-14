import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileOutput, Download, Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';

export default function TextToPdfView() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('NoteZ Document');
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState(false);

  async function generatePdf() {
    if (!text.trim()) return;
    setGenerating(true);
    setSuccess(false);

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      const lineHeight = 7;
      let y = margin + 5;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(fileName || 'NoteZ Document', margin, y);
      y += 12;

      // Date
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
      y += 10;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Body text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);

      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `${fileName} — Page ${i} of ${totalPages} — NoteZ`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`${fileName.trim() || 'NoteZ Document'}.pdf`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
          <FileOutput className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight leading-none">{t('tools.textToPdf.title')}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('tools.textToPdf.desc')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary p-5 space-y-4">
        {/* File name input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t('tools.textToPdf.fileName')}</label>
          <input
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            placeholder="Document name…"
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Text area */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Content</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('tools.textToPdf.placeholder')}
            rows={12}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">
              {text.trim() ? text.trim().split(/\s+/).length : 0} words · {text.length} chars
            </span>
          </div>
        </div>

        {/* Generate button */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={generatePdf}
            disabled={!text.trim() || generating}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px] hover:opacity-90 transition-opacity shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : success ? (
              <Check className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {generating ? t('tools.textToPdf.generating') : success ? t('tools.textToPdf.success') : t('tools.textToPdf.generate')}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
