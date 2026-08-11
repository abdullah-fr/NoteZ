/** Convert stored note HTML into plain text for previews, metadata, and clipboard fallbacks. */
export function htmlToPlainText(html: string): string {
  try {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent ?? div.innerText ?? '';
  } catch {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
