/** The http(s) URLs in pasted text, one per line, trimmed and deduplicated. */
export function parseBatchUrls(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^https?:\/\/\S+$/.test(line)),
    ),
  ];
}

/** A readable fallback name for a URL whose analysis failed. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
