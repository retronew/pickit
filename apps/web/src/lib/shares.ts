import { api, copyText, toastError } from "#lib/api";

export type ShareType = "item" | "category" | "tag";

export const SHARE_TYPE_LABELS: Record<ShareType, string> = {
  item: "单条",
  category: "分类",
  tag: "标签",
};

export const shareUrl = (slug: string) => `${window.location.origin}/s/${slug}`;
export const rssUrl = (slug: string) => `${window.location.origin}/api/public/shares/${slug}/rss`;

/** Creates (or reuses) a public link and copies it. Returns the slug. */
export async function shareAndCopy(type: ShareType, value: string, title?: string): Promise<string | null> {
  try {
    const { slug } = await api<{ slug: string }>("/api/shares", { json: { type, value, title } });
    await copyText(shareUrl(slug), "分享链接已复制");
    return slug;
  } catch (err) {
    toastError("分享失败", err, { id: "share" });
    return null;
  }
}
