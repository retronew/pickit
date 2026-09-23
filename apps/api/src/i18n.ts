import {
  baseLocale,
  isLocale,
  renderMessage,
  type Locale,
  type MessageRef,
} from "@pickit/shared/i18n";
import type { Env } from "#types";
import { uiLocale } from "#locale";

export { m, renderMessage, type Locale, type MessageRef } from "@pickit/shared/i18n";

// Which language to answer a request in: the web app's cookie, a header for
// scripts, then the owner's saved interface language.

export const LOCALE_COOKIE = "pickit_locale";
export const LOCALE_HEADER = "x-pickit-locale";

const resolved = new WeakMap<Request, Promise<Locale>>();

function fromCookie(header: string | null): string | null {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** What these helpers need from a Hono context (any route's context fits). */
type AnyContext = { env: Env; req: { raw: Request } };

export function requestLocale(c: AnyContext): Promise<Locale> {
  const req = c.req.raw;
  let locale = resolved.get(req);
  if (!locale) {
    const explicit = fromCookie(req.headers.get("cookie")) ?? req.headers.get(LOCALE_HEADER);
    locale = isLocale(explicit)
      ? Promise.resolve(explicit)
      : uiLocale(c.env.DB).catch((): Locale => baseLocale as Locale);
    resolved.set(req, locale);
  }
  return locale;
}

/** Renders a message in the request's language. */
export async function tr(
  c: AnyContext,
  key: string,
  params?: MessageRef["params"],
): Promise<string> {
  return renderMessage({ key, params }, await requestLocale(c));
}

/** An error whose user-facing message is rendered per request. */
export class LocalizedError extends Error {
  constructor(
    readonly ref: MessageRef,
    readonly status: 400 | 404 | 409 | 503 = 400,
  ) {
    super(renderMessage(ref, baseLocale));
  }
}

/** JSON error response in the request's language. */
export async function localizedError(c: AnyContext, err: LocalizedError): Promise<Response> {
  return Response.json({ error: renderMessage(err.ref, await requestLocale(c)) }, { status: err.status });
}

/** A message in the owner's interface language, for errors stored outside a request (jobs). */
export async function errorText(env: Env, key: string, params?: MessageRef["params"]): Promise<string> {
  const locale: Locale = await uiLocale(env.DB).catch(() => baseLocale as Locale);
  return renderMessage({ key, params }, locale);
}
