import { useEffect, useMemo, useState } from "react";
import { throttle } from "es-toolkit";
import { ArrowUpIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { cn } from "#lib/utils";
import { smoothScrollToTop } from "#lib/scroll";

export function BackToTop() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const onScroll = useMemo(
    () => throttle(() => setShow(window.scrollY > 480), 100),
    [],
  );

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
      variant="secondary"
      size="icon"
      aria-label="回到顶部"
      onClick={() => smoothScrollToTop()}
      className={cn(
        // Cleared above AskAi's fixed input bar (~pb-4/6 + pill height) so
        // the two floating controls never overlap.
        "z-fab fixed right-4 bottom-24 rounded-full shadow-lg/10 transition-[opacity,transform] ease-[var(--ease-smooth-out)] sm:right-6 sm:bottom-28",
        visible
          ? "scale-100 opacity-100 duration-[var(--duration-fast)]"
          : "pointer-events-none scale-[var(--scale-large)] opacity-0 duration-[var(--duration-quick)]",
      )}
    >
      <ArrowUpIcon />
    </Button>
  );
}
