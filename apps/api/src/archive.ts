// Wayback Machine snapshots for links that went dead.

const AVAILABILITY_API = "https://archive.org/wayback/available?url=";

/**
 * The closest available Wayback Machine snapshot of `url`, or "" when there
 * is none or archive.org can't be reached.
 */
export async function findArchiveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(AVAILABILITY_API + encodeURIComponent(url), {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as {
      archived_snapshots?: { closest?: { available?: boolean; url?: string } };
    };
    const closest = data.archived_snapshots?.closest;
    if (!closest?.available || !closest.url) return "";
    // The API answers with http:// snapshot URLs; the site serves https.
    return closest.url.replace(/^http:\/\//, "https://");
  } catch {
    return "";
  }
}
