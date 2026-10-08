/** Lower-case, accent-free, collapsed-whitespace form used for every search (§4.10, §4.16, §5.9). */
export function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function includesNormalized(haystack: string | null | undefined, needle: string): boolean {
  const n = normalize(needle);
  return n.length === 0 || normalize(haystack).includes(n);
}

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
