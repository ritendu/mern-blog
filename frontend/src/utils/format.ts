export function excerpt(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}...` : clean;
}

export function readTime(text: string): string {
  const minutes = Math.max(1, Math.round(text.trim().split(/\s+/).length / 200));
  return `${minutes} min read`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function initials(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}
