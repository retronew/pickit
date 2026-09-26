// Chooses how a page snapshot is made. The page is always fetched directly
// (free, fast). With Browser Rendering on and within its limit, the result
// becomes Markdown: from the article HTML we already have when the page is
// readable without JavaScript (quick, so little browser time), else by
// rendering the URL in a browser. Anything that goes wrong falls back to the
// plain text.

import type { Env } from "#types";
import { fetchPageText } from "#page-text";
import { acquireBrowser, renderMarkdown, type RenderInput } from "#browser-render";

/** Enough plain text that the page doesn't need JavaScript to show its article. */
const READABLE_WITHOUT_JS = 500;
/** Upgrading old snapshots may use only this share of the limit, so new bookmarks still get rendered. */
const UPGRADE_BUDGET_SHARE = 0.5;

export type ContentFormat = "text" | "markdown";

export type Capture =
  /** `rendered`: Browser Rendering was tried. */
  | { ok: true; text: string; format: ContentFormat; rendered: boolean }
  | { ok: false; error: string; rendered: boolean }
  /** Nothing done; a later batch will come back to it. */
  | { ok: "deferred" }
  /** An upgrade was tried but gave no Markdown: keep the snapshot as it is. */
  | { ok: "unchanged" };

interface Options {
  /** A batch that can come back later: waits for the free plan's 10-second slot instead of settling for plain text. */
  background?: boolean;
  /** Only worth doing as Markdown (turning an old plain-text snapshot into Markdown). */
  upgrade?: boolean;
}

export async function capturePage(env: Env, url: string, { background = false, upgrade = false }: Options = {}): Promise<Capture> {
  const access = await acquireBrowser(env, Date.now(), upgrade ? UPGRADE_BUDGET_SHARE : 1).catch(
    () => ({ ok: false, reason: "off" }) as const,
  );
  if (!access.ok && (upgrade || (background && access.reason === "throttled"))) return { ok: "deferred" };

  const plain = await fetchPageText(url);
  if (!access.ok) return plain.ok ? { ok: true, text: plain.text, format: "text", rendered: false } : { ...plain, rendered: false };

  const input: RenderInput =
    plain.ok && plain.html && plain.text.length >= READABLE_WITHOUT_JS ? { html: plain.html, baseUrl: url } : { url };
  const rendered = await renderMarkdown(env.DB, access, input);
  // A render much shorter than the plain text lost the article somewhere.
  const plainLength = plain.ok ? plain.text.length : 0;
  if (rendered.ok && rendered.markdown && rendered.markdown.length >= plainLength * 0.5) {
    return { ok: true, text: rendered.markdown, format: "markdown", rendered: true };
  }
  if (upgrade) return { ok: "unchanged" };
  return plain.ok ? { ok: true, text: plain.text, format: "text", rendered: true } : { ...plain, rendered: true };
}
