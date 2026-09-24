import { api } from "#lib/api";
import { m } from "#lib/i18n";

export type ShareType = "item" | "category" | "tag" | "mix" | "collection";

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
  /** When the link stops working; null = never. */
  expiresAt: number | null;
  hasPassword: boolean;
  /** Password-protected shares: the key that opens the page / feed for the owner. */
  accessKey?: string;
}

/** Changes to a share's access; undefined = leave as is, null = remove. */
export interface ShareAccess {
  expiresAt?: number | null;
  password?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Expiry choices offered in the share dialogs. */
export const EXPIRY_PRESETS = ["never", "1", "7", "30", "90"] as const;
export type ExpiryPreset = (typeof EXPIRY_PRESETS)[number];

export const EXPIRY_LABELS: Record<ExpiryPreset, () => string> = {
  never: m.share_expiry_never,
  "1": () => m.share_expiry_days({ count: 1 }),
  "7": () => m.share_expiry_days({ count: 7 }),
  "30": () => m.share_expiry_days({ count: 30 }),
  "90": () => m.share_expiry_days({ count: 90 }),
};

/** The expiry timestamp for a preset, counted from now; null for "never". */
export const expiryAt = (preset: ExpiryPreset, now = Date.now()) =>
  preset === "never" ? null : now + Number(preset) * DAY_MS;

export const isExpired = (s: Pick<Share, "expiresAt">, now = Date.now()) =>
  s.expiresAt !== null && s.expiresAt <= now;

/** Whole days left before a share expires (at least 1 while it is still live). */
export const daysLeft = (expiresAt: number, now = Date.now()) => Math.max(1, Math.ceil((expiresAt - now) / DAY_MS));

/** What to share: one item / category / tag, several of them, or a hand-picked collection. */
export type ShareTarget =
  | { type: "item" | "category" | "tag"; value: string }
  | { type: "mix"; categories: string[]; tags: string[] }
  | { type: "collection"; ids: number[] };

export const SHARE_TYPE_LABELS: Record<ShareType, string> = {
  item: m.share_type_item(),
  category: m.share_type_category(),
  tag: m.share_type_tag(),
  mix: m.share_type_mix(),
  collection: m.share_type_collection(),
};

export const shareUrl = (slug: string) => `${window.location.origin}/s/${slug}`;
/** The RSS link; a protected feed carries its access key so readers can fetch it. */
export const rssUrl = (slug: string, key?: string) =>
  `${window.location.origin}/api/public/shares/${slug}/rss${key ? `?key=${key}` : ""}`;

/** Picked categories and tags as a target: a single one keeps its own type. */
export function pickedTarget(categories: string[], tags: string[]): ShareTarget | null {
  if (categories.length + tags.length === 0) return null;
  if (categories.length === 1 && tags.length === 0) return { type: "category", value: categories[0] };
  if (tags.length === 1 && categories.length === 0) return { type: "tag", value: tags[0] };
  return { type: "mix", categories, tags };
}

/** "前端 · #ai" (matches the API's mixTitle). */
function mixTitle(categories: string[], tags: string[]): string {
  return [...categories, ...tags.map((t) => `#${t}`)].join(" · ");
}

function parseMix(value: string): { categories: string[]; tags: string[] } {
  try {
    const v = JSON.parse(value);
    return { categories: v?.categories ?? [], tags: v?.tags ?? [] };
  } catch {
    return { categories: [], tags: [] };
  }
}

/** The title a share gets when none is entered (matches the API's default). */
export function defaultShareTitle(target: ShareTarget): string {
  if (target.type === "collection") return m.share_collection_default_title({ count: target.ids.length });
  if (target.type === "mix") return mixTitle([...target.categories].sort(), [...target.tags].sort());
  if (target.type === "category") return target.value;
  if (target.type === "tag") return `#${target.value}`;
  return "";
}

/** A short description of what a share contains, for lists. */
export function shareSubject(s: Share): string {
  if (s.type === "collection") return m.items_total({ count: s.itemCount ?? 0 });
  if (s.type === "mix") {
    const { categories, tags } = parseMix(s.value);
    return mixTitle(categories, tags);
  }
  if (s.type === "tag") return `#${s.value}`;
  if (s.type === "category") return s.value;
  return "";
}

export async function createShare(target: ShareTarget, title?: string, access: ShareAccess = {}): Promise<string> {
  const { slug } = await api<{ slug: string }>("/api/shares", { json: { ...target, title, ...access } });
  return slug;
}

export const updateShareAccess = (slug: string, access: ShareAccess) =>
  api<Share>(`/api/shares/${slug}`, { method: "PATCH", json: access });

