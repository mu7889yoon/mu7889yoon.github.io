export function normalizeText(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isUsefulToken(token) {
  if (!token || token.length > 64) return false;
  if (/^[\p{P}\p{S}]+$/u.test(token)) return false;
  if (/^[ぁ-んー]$/u.test(token)) return false;
  return true;
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeLike(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
