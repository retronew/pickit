import { useState } from "react";

// Served by our API, which caches icons at Cloudflare's edge (30 days) and
// lets the browser keep them for a week, instead of hitting Google each view.
function faviconSrc(url: string) {
  try {
    return `/api/public/favicon/${new URL(url).hostname}`;
  } catch {
    return "";
  }
}

export function Favicon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconSrc(url);

  if (!src || failed) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] text-foreground">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-4 w-4 shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}
