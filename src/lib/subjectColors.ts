/**
 * Shared subject colour palette — single source of truth.
 *
 * These are the exact 8 colours used by FolderView's colour picker.
 * Any component that wants "the colour for a subject" should import
 * getSubjectColor() rather than maintaining its own palette.
 */
export const SUBJECT_COLORS = [
  '#8B5CF6', // purple
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
] as const;

/**
 * Returns a deterministic colour from the palette for any subject name.
 *
 * The same string always maps to the same colour — even before a matching
 * Folder exists — so colour-coded subject labels are stable across views.
 *
 * If a matching folder is found in localStorage (name match, case-insensitive),
 * that folder's exact colour is returned instead, keeping things pixel-perfect.
 */
export function getSubjectColor(subjectName: string): string {
  // Prefer the folder colour when the subject name matches a folder exactly.
  try {
    const raw = localStorage.getItem('notez_folders');
    if (raw) {
      const folders: { name: string; color: string }[] = JSON.parse(raw);
      const match = folders.find(
        f => f.name.toLowerCase() === subjectName.toLowerCase(),
      );
      if (match?.color) return match.color;
    }
  } catch {
    // localStorage unavailable or parse failure — fall through to hash
  }

  // Deterministic hash → palette index
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = (hash * 31 + subjectName.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}
