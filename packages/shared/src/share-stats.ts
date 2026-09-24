// Visit stats of a public share link: returned by GET /api/shares/:slug/stats
// and shown in the stats dialog on the shares page.

export type VisitKind = "page" | "rss";
export type DeviceKind = "desktop" | "mobile" | "tablet" | "";

export interface ShareVisit {
  at: number;
  kind: VisitKind;
  /** Referring site's host; "" for a direct visit. */
  referrer: string;
  /** ISO country code; "" when unknown. */
  country: string;
  browser: string;
  os: string;
  device: DeviceKind;
}

export interface ShareStats {
  total: number;
  lastViewedAt: number | null;
  last30: number;
  /** Distinct visitors in the last 30 days. */
  visitors30: number;
  /** Oldest first, one entry per day (UTC) for the last 30 days. */
  byDay: { day: string; page: number; rss: number }[];
  referrers: { host: string; count: number }[];
  countries: { country: string; count: number }[];
  recent: ShareVisit[];
}
