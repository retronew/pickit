/** EvilCharts color entry using the same theme token in light and dark (the token itself adapts). */
export function chartColor(token: string) {
  return { colors: { light: [token], dark: [token] } };
}
