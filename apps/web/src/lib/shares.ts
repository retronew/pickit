import { api, copyText, toastError } from "#lib/api";
import { m } from "#lib/i18n";

export type ShareType = "item" | "category" | "tag";

export const SHARE_TYPE_LABELS: Record<ShareType, string> = {
  item: m.share_type_item(),
  category: m.share_type_category(),
  tag: m.share_type_tag(),
};

export const shareUrl = (slug: string) => `${window.location.origin}/s/${slug}`;
export const rssUrl = (slug: string) => `${window.location.origin}/api/public/shares/${slug}/rss`;

/** Creates (or reuses) a public link and copies it. Returns the slug. */
export async function shareAndCopy(type: ShareType, value: string, title?: string): Promise<string | null> {
  try {
    const { slug } = await api<{ slug: string }>("/api/shares", { json: { type, value, title } });
    await copyText(shareUrl(slug), m.share_link_copied());
    return slug;
  } catch (err) {
    toastError(m.share_failed(), err, { id: "share" });
    return null;
  }
}
