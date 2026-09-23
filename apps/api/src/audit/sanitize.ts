// Request bodies are stored with secrets redacted and long values cut.

const SECRET_KEY = /key|secret|token|password|authorization/i;
const MAX_STRING = 200;
const MAX_ARRAY = 20;

export function sanitize(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[${value.length}]` : value;
  }
  if (value === null || typeof value !== "object") return value;
  if (depth >= 4) return "…";
  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_ARRAY).map((v) => sanitize(v, depth + 1));
    if (value.length > MAX_ARRAY) out.push(`…[${value.length}]`);
    return out;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SECRET_KEY.test(k) && typeof v === "string" && v ? "***" : sanitize(v, depth + 1);
  }
  return out;
}
