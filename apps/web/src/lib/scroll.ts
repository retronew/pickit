// Apple's signature ease-out deceleration curve (matches --ease-smooth-out).
function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function smoothScrollToTop(duration = 600) {
  const start = window.scrollY;
  if (start <= 0) return;
  const startTime = performance.now();
  function step(now: number) {
    const t = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, start * (1 - easeOutExpo(t)));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
