import { useState } from "react";

function faviconSrc(url: string) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
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
