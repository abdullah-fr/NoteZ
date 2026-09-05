const MAX_UPLOAD_BYTES = 120 * 1024 * 1024;

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  'txt', 'md', 'pdf', 'doc', 'docx', 'ppt', 'pptx',
  'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac',
  'mp4', 'mov', 'webm', 'mkv',
  'png', 'jpg', 'jpeg',
]);

/**
 * Client-side upload guard for immediate feedback. Storage bucket limits and
 * the processing function remain the authoritative server-side boundary.
 */
export function validateUploadFile(file: File): void {
  if (file.size === 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('File too large — max 120 MB.');

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    throw new Error('Unsupported file type.');
  }
}

export { MAX_UPLOAD_BYTES };
