import { useRef, useEffect, useCallback } from "react";

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback(async (e: TouchEvent) => {
    if (!pulling.current) return;
    pulling.current = false;
    const diff = e.changedTouches[0].clientY - startY.current;
    if (diff > 80) {
      await onRefresh();
    }
  }, [onRefresh]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
}
