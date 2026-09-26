// Chooses how a page snapshot is made. The page is always fetched directly
// first (free, fast). With Browser Rendering on and within its limit, the
// result becomes Markdown: from the article HTML we already have when the
// page is readable without JavaScript (quick, so little browser time), else
// by rendering the URL in a browser. Anything that goes wrong falls back to
// the plain text.

import type { Env } from "#types";
import { fetchPageText, type FetchedText } from "#page-text";
import { acquireBrowser, renderMarkdown, type RenderInput } from "#browser-render";

/** Enough plain text that the page doesn't need JavaScript to show its article. */
const READABLE_WITHOUT_JS = 500;

export type Capture = FetchedText | { ok: "deferred" };

/**
 * `background`: a batch that can come back later. When the free plan's
 * 10-second slot is taken it defers instead of settling for plain text.
 */
export async function capturePage(env: Env, url: string, { background = false } = {}): Promise<Capture> {
  const plain = await fetchPageText(url);
  const access = await acquireBrowser(env).catch(() => ({ ok: false, reason: "off" }) as const);
  if (!access.ok) return access.reason === "throttled" && background ? { ok: "deferred" } : plain;

  const input: RenderInput =
    plain.ok && plain.html && plain.text.length >= READABLE_WITHOUT_JS ? { html: plain.html, baseUrl: url } : { url };
  const rendered = await renderMarkdown(env.DB, access, input);
  // A render much shorter than the plain text lost the article somewhere.
  const plainLength = plain.ok ? plain.text.length : 0;
  if (rendered.ok && rendered.markdown && rendered.markdown.length >= plainLength * 0.5) {
    return { ok: true, text: rendered.markdown };
  }
  return plain;
}
