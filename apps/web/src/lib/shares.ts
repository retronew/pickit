import { api } from "#lib/api";
import { m } from "#lib/i18n";

export type ShareType = "item" | "category" | "tag" | "collection";

export interface Share {
  slug: string;
  title: string;
  type: ShareType;
  value: string;
  /** Collections only: how many items were picked. */
  itemCount?: number;
  createdAt: number;
  viewCount: number;
  lastViewedAt: number | null;
}

/** What to share: one item / category / tag, or a hand-picked collection. */
export type ShareTarget =
  | { type: "item" | "category" | "tag"; value: string }
  | { type: "collection"; ids: number[] };

export const SHARE_TYPE_LABELS: Record<ShareType, string> = {
  item: m.share_type_item(),
  category: m.share_type_category(),
  tag: m.share_type_tag(),
  collection: m.share_type_collection(),
};

export const shareUrl = (slug: string) => `${window.location.origin}/s/${slug}`;
export const rssUrl = (slug: string) => `${window.location.origin}/api/public/shares/${slug}/rss`;

/** The title a share gets when none is entered (matches the API's default). */
export function defaultShareTitle(target: ShareTarget): string {
  if (target.type === "collection") return m.share_collection_default_title({ count: target.ids.length });
  if (target.type === "category") return target.value;
  if (target.type === "tag") return `#${target.value}`;
  return "";
}

/** A short description of what a share contains, for lists. */
export function shareSubject(s: Share): string {
  if (s.type === "collection") return m.items_total({ count: s.itemCount ?? 0 });
  if (s.type === "tag") return `#${s.value}`;
  if (s.type === "category") return s.value;
  return "";
}

export async function createShare(target: ShareTarget, title?: string): Promise<string> {
  const { slug } = await api<{ slug: string }>("/api/shares", { json: { ...target, title } });
  return slug;
}

