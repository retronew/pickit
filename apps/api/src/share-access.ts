// Share access limits: expiry and an optional password. The password is
// stored as a salted PBKDF2 hash. Entering it returns an access key (an HMAC
// of the slug and that hash), which the share page sends back and the RSS
// link carries as ?key=. A new password changes the hash, so old keys stop
// working.

const ITERATIONS = 100_000;
const encoder = new TextEncoder();

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(bits);
}

/** Constant-time comparison of two hex strings. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${await pbkdf2(password, salt, ITERATIONS)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !hash) return false;
  return sameHex(await pbkdf2(password, fromHex(salt), Number(iterations)), hash);
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(data))).slice(0, 32);
}

/** The key that unlocks a password-protected share until its password changes. */
export const accessKey = (secret: string, slug: string, passwordHash: string) =>
  hmac(secret, `share:${slug}:${passwordHash}`);

export interface ShareAccess {
  expires_at: number | null;
  password_hash: string | null;
  slug: string;
}

export type AccessResult = "ok" | "expired" | "locked";

/** Whether a request may see the share: not expired, and unlocked when it has a password. */
export async function checkAccess(
  share: ShareAccess,
  key: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<AccessResult> {
  if (share.expires_at !== null && share.expires_at <= now) return "expired";
  if (!share.password_hash) return "ok";
  if (key && sameHex(key, await accessKey(secret, share.slug, share.password_hash))) return "ok";
  return "locked";
}

export const PASSWORD_MAX = 100;

/**
 * Normalizes an access update from the API. `undefined` = leave as is,
 * `null` = remove, otherwise the new value. Throws "invalid" on bad input.
 */
export function parseAccessInput(body: { expiresAt?: unknown; password?: unknown }) {
  const { expiresAt, password } = body;
  if (expiresAt !== undefined && expiresAt !== null && !(Number.isFinite(expiresAt) && (expiresAt as number) > 0)) {
    throw new Error("invalid");
  }
  if (password !== undefined && password !== null && (typeof password !== "string" || password.length > PASSWORD_MAX)) {
    throw new Error("invalid");
  }
  return {
    expiresAt: expiresAt as number | null | undefined,
    // An empty password means "no password".
    password: password === "" ? null : (password as string | null | undefined),
  };
}
