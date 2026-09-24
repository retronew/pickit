import { useEffect, useMemo, useState } from "react";
import { throttle } from "es-toolkit";
import { ArrowUpIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { cn } from "#lib/utils";
import { m } from "#lib/i18n";

export function BackToTop() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const onScroll = useMemo(
    () => throttle(() => setShow(window.scrollY > 480), 100),
    [],
  );

  // Throttled so repeated clicks don't restart the native smooth scroll.
  const scrollToTop = useMemo(
    () =>
      throttle(() => window.scrollTo({ top: 0, behavior: "smooth" }), 300, {
        edges: ["leading"],
      }),
    [],
  );

  useEffect(() => () => scrollToTop.cancel(), [scrollToTop]);

  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      onScroll.cancel();
    };
  }, [onScroll]);

  useEffect(() => {
    if (show) {
      setMounted(true);
      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf1);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 150); // matches close duration below
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={m.back_to_top()}
      onClick={scrollToTop}
      className={cn(
        // Cleared above AskAi's fixed input bar (~pb-4/6 + pill height) so
        // the two floating controls never overlap.
        "z-fab fixed right-4 bottom-24 rounded-full shadow-lg/5 backdrop-blur-sm transition-[opacity,translate,scale] [&_svg]:transition-transform hover:[&_svg]:-translate-y-0.5 ease-[var(--ease-smooth-out)] sm:right-6 sm:bottom-28",
        visible
          ? "translate-y-0 scale-100 opacity-100 duration-[var(--duration-fast)]"
          : "pointer-events-none translate-y-2 scale-95 opacity-0 duration-[var(--duration-quick)]",
      )}
    >
      <ArrowUpIcon />
    </Button>
  );
}
