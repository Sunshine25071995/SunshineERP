import { useEffect, useState, useCallback } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    let startY = 0;
    let currentY = 0;
    const threshold = 80;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0) return;
      currentY = e.touches[0].clientY;
      if (currentY > startY && window.scrollY <= 0) {
        setIsPulling(true);
      } else {
        setIsPulling(false);
      }
    };

    const handleTouchEnd = async () => {
      if (isPulling && currentY - startY > threshold) {
        await onRefresh();
      }
      startY = 0;
      currentY = 0;
      setIsPulling(false);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, isPulling]);

  return { isPulling };
}
