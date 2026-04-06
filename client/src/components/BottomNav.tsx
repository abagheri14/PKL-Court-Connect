import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Home, Users, MapPin, MessageCircle, User, Bell, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useEffect, useState } from "react";

const tabs = [
  { id: "home" as const, labelKey: "nav.home", icon: Home },
  { id: "swipe" as const, labelKey: "nav.swipe", icon: Users },
  { id: "activityFeed" as const, labelKey: "nav.feed", icon: Newspaper },
  { id: "nearby" as const, labelKey: "nav.nearby", icon: MapPin },
  { id: "matches" as const, labelKey: "nav.matches", icon: MessageCircle },
  { id: "profile" as const, labelKey: "nav.profile", icon: User },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useApp();
  const { t } = useTranslation();
  const matchesQuery = trpc.matches.list.useQuery(undefined, { refetchInterval: 30000, refetchIntervalInBackground: false, staleTime: 10000 });
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: false });
  const unreadMatchCount = matchesQuery.data?.filter(m => m.unreadCount > 0).length ?? 0;
  const unreadNotifCount = (notificationsQuery.data ?? []).filter((n: any) => !n.isRead).length;
  const navRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Calculate sliding indicator position
  useEffect(() => {
    if (!navRef.current) return;
    const activeIndex = tabs.findIndex(t => t.id === activeTab);
    if (activeIndex < 0) return;
    const buttons = navRef.current.querySelectorAll<HTMLButtonElement>('[data-nav-tab]');
    const btn = buttons[activeIndex];
    if (!btn) return;
    const navRect = navRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicatorStyle({
      left: btnRect.left - navRect.left + btnRect.width / 2 - 20,
      width: 40,
    });
  }, [activeTab]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      {/* Top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Frosted background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-2xl border-t border-primary/10" style={{ backdropFilter: 'blur(24px) saturate(1.4)' }} />

      <div ref={navRef} className="relative flex items-center justify-around h-[68px] max-w-lg mx-auto px-0.5" role="tablist">
        {/* Sliding indicator pill */}
        <div
          className="absolute top-2 h-[3px] rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
        />

        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              data-nav-tab={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 relative group",
                isActive ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              <div className="relative">
                {/* Background glow for active state */}
                {isActive && (
                  <div className="absolute inset-[-8px] rounded-full bg-primary/10 blur-md" />
                )}
                <Icon
                  className={cn(
                    "relative transition-all duration-300",
                    isActive 
                      ? "scale-110 text-secondary drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]" 
                      : "group-hover:scale-105"
                  )}
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {tab.id === "matches" && unreadMatchCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                    {unreadMatchCount}
                  </span>
                )}
                {tab.id === "home" && unreadNotifCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 bg-secondary text-secondary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-[0_0_8px_rgba(255,215,0,0.4)]">
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive ? "text-secondary font-semibold" : "opacity-70 group-hover:opacity-100"
              )}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
