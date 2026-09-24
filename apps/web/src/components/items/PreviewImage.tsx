import { useState } from "react";
import { cn } from "#lib/utils";

/**
 * A bookmark's preview image (og:image). Lazy-loaded, and removed when it
 * fails to load (hotlink protection, expired CDN URLs) instead of showing a
 * broken image. Renders nothing without a URL.
 */
export function PreviewImage({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("rounded-md border bg-muted object-cover", className)}
    />
  );
}
