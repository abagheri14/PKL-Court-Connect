import { useRef, useCallback, type TouchEvent } from "react";
import { useApp } from "@/contexts/AppContext";

const TAB_ORDER = ["home", "swipe", "activityFeed", "nearby", "matches", "profile"] as const;

// Screens where horizontal swipe is used for other purposes
const SWIPE_DISABLED_SCREENS = new Set(["swipe", "login", "onboarding", "tutorial"]);

const MIN_DISTANCE = 60;
const MAX_Y_RATIO = 0.7; // Must be mostly horizontal

export function useSwipeNavigation() {
  const { activeTab, setActiveTab, screen } = useApp();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return;
    if (SWIPE_DISABLED_SCREENS.has(screen)) return;

    // Only allow on tab screens
    const tabIndex = TAB_ORDER.indexOf(activeTab as any);
    if (tabIndex < 0) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    // Must be mostly horizontal and exceed min distance
    if (Math.abs(dx) < MIN_DISTANCE) return;
    if (Math.abs(dy) > Math.abs(dx) * MAX_Y_RATIO) return;

    if (dx < 0 && tabIndex < TAB_ORDER.length - 1) {
      // Swipe left → next tab
      setActiveTab(TAB_ORDER[tabIndex + 1]);
    } else if (dx > 0 && tabIndex > 0) {
      // Swipe right → previous tab
      setActiveTab(TAB_ORDER[tabIndex - 1]);
    }
  }, [screen, activeTab, setActiveTab]);

  return { onTouchStart, onTouchEnd };
}
