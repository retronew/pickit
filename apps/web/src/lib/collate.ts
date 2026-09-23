/**
 * One fixed ordering for category / tag names everywhere: Chinese by pinyin,
 * numbers numerically. Without an explicit locale the order would follow
 * each browser's language.
 */
export const compareText = new Intl.Collator("zh-CN", { numeric: true }).compare;

export function sortText(values: string[]): string[] {
  return [...values].sort(compareText);
}
