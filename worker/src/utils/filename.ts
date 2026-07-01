export function sanitizeFilename(value: string): string {
  const basename = value.split(/[\\/]/).at(-1)?.trim() ?? "";
  const normalized = basename.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ");
  const safe = normalized.replace(/[^\w .()[\]-]/g, "_").replace(/^\.+$/, "");
  const trimmed = safe.slice(0, 180).trim();
  return trimmed || "attachment";
}

export function contentDispositionInline(filename: string): string {
  return `inline; filename="${filename.replaceAll('"', '\\"')}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

