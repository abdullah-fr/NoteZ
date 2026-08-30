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
 * Pass the current user's already-loaded folders when an exact folder colour
 * should win. This helper intentionally does not read browser storage because
 * a synchronous global key cannot be associated safely with an account.
 */
export function getSubjectColor(
  subjectName: string,
  folders: readonly { name: string; color: string }[] = [],
): string {
  // Prefer the folder colour when the subject name matches a folder exactly.
  const match = folders.find(f => f.name.toLowerCase() === subjectName.toLowerCase());
  if (match?.color) return match.color;

  // Deterministic hash → palette index
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = (hash * 31 + subjectName.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}
