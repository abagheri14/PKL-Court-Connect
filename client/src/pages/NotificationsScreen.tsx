import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { formatTimeAgo } from "@/lib/avatarUtils";
import { ArrowLeft, Bell, MessageSquare, Trophy, Calendar, ShieldCheck, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { QueryError } from "@/components/QueryError";
import { toast } from "sonner";

const filterTabKeys = [
  { key: "All", i18n: "notifications.filterAll" },
  { key: "Matches", i18n: "notifications.filterMatches" },
  { key: "Messages", i18n: "notifications.filterMessages" },
  { key: "Games", i18n: "notifications.filterGames" },
  { key: "Achievements", i18n: "notifications.filterAchievements" },
  { key: "System", i18n: "notifications.filterSystem" },
];

const iconMap: Record<string, React.ReactNode> = {
  match: <Bell size={16} className="text-primary" />,
  message: <MessageSquare size={16} className="text-blue-400" />,
  game_invite: <Calendar size={16} className="text-green-400" />,
  tournament_invite: <Trophy size={16} className="text-[#FFC107]" />,
  achievement: <Trophy size={16} className="text-secondary" />,
  system: <ShieldCheck size={16} className="text-accent" />,
};

const tabTypeMap: Record<string, string | null> = {
  All: null,
  Matches: "match",
  Messages: "message",
  Games: "game_invite",
  Achievements: "achievement",
  System: "system",
};

function getTimeGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffHours < 24 && date.getDate() === now.getDate()) return "today";
  if (diffDays < 2) return "yesterday";
  if (diffDays < 7) return "thisWeek";
  return "earlier";
}

const timeGroupI18nMap: Record<string, string> = {
  today: "notifications.groupToday",
  yesterday: "notifications.groupYesterday",
  thisWeek: "notifications.groupThisWeek",
  earlier: "notifications.groupEarlier",
};

export default function NotificationsScreen() {
  const { navigate, goBack, selectMatch, selectGame, selectTournament } = useApp();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { refetchInterval: 15000 });
  const notifications: any[] = notificationsQuery.data ?? [];
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });
  const deleteAllMutation = trpc.notifications.deleteAll.useMutation({
    onSuccess: () => { utils.notifications.list.invalidate(); toast.success(t("notifications.allCleared")); },
    onError: (err) => toast.error(err.message),
  });
  const [activeFilter, setActiveFilter] = useState("All");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const unreadNotifCount = notifications.filter((n: any) => !n.isRead).length;

  const filtered = activeFilter === "All"
    ? notifications
    : notifications.filter((n: any) => n.type === tabTypeMap[activeFilter]);

  // Group filtered notifications by time
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const order = ["today", "yesterday", "thisWeek", "earlier"];
    for (const n of filtered) {
      const group = getTimeGroup(n.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(n);
    }
    return order.filter(g => groups[g]?.length).map(g => ({ label: g, items: groups[g] }));
  }, [filtered]);

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  return (
    <div className="pb-24 min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-accent/6 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} aria-label="Go back" className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("notifications.title")}</h1>
        {unreadNotifCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadNotifCount}</span>
        )}
        <div className="ml-auto flex gap-1.5">
          {unreadNotifCount > 0 && (
            <Button onClick={handleMarkAllRead} variant="ghost" size="sm" className="text-xs text-secondary h-8 px-2">
              <CheckCheck size={14} className="mr-1" /> {t("notifications.readAll")}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              onClick={() => setShowClearConfirm(true)}
              variant="ghost"
              size="sm"
              className="text-xs text-red-400 h-8 px-2"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
        </div>
      </div>

      {/* Clear All Confirmation */}
      {showClearConfirm && (
        <div className="px-5 pb-3">
          <div className="card-elevated rounded-xl p-4 border-red-500/30">
            <p className="text-sm font-semibold mb-1">{t("notifications.clearAllTitle")}</p>
            <p className="text-xs text-muted-foreground mb-3">{t("notifications.clearAllDesc")}</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-red-500 text-white hover:bg-red-600" onClick={() => { deleteAllMutation.mutate(); setShowClearConfirm(false); }}>
                {t("notifications.clearAll")}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowClearConfirm(false)}>
                {t("notifications.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="px-5 pb-4 flex gap-1.5 overflow-x-auto scrollbar-none">
        {filterTabKeys.map(tab => {
          const count = tab.key === "All" ? notifications.length : notifications.filter((n: any) => n.type === tabTypeMap[tab.key]).length;
          return (
          <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
            className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
              activeFilter === tab.key ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
            )}
          >
            {t(tab.i18n)}{count > 0 ? ` (${count})` : ""}
          </button>
          );
        })}
      </div>

      {/* Notification List — Grouped by time */}
      <div className="px-5 space-y-4">
        {notificationsQuery.isError && !notifications.length ? (
          <QueryError message={t("notifications.failedToLoad")} onRetry={() => notificationsQuery.refetch()} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={40} className="mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">{t("notifications.noNotifications")}</p>
            <p className="text-[10px] text-muted-foreground/60">{t("notifications.allCaughtUp")}</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">{t(timeGroupI18nMap[group.label])}</p>
              <div className="space-y-2">
                {group.items.map((notif: any) => (
                  <button
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) markReadMutation.mutate({ notificationId: notif.id });
                      if (notif.type === "match") {
                        if (notif.targetId) selectMatch(null, notif.targetId);
                        else navigate("matches");
                      }
                      else if (notif.type === "message") {
                        if (notif.targetId) selectMatch(null, notif.targetId);
                        else navigate("matches");
                      }
                      else if (notif.type === "game_invite") {
                        if (notif.targetId) selectGame(notif.targetId);
                        else navigate("gameHistory");
                      }
                      else if (notif.type === "tournament_invite") {
                        if (notif.targetId) selectTournament(notif.targetId);
                        else navigate("tournaments");
                      }
                      else if (notif.type === "achievement") navigate("achievements");
                    }}
                    className={cn(
                      "w-full text-left card-elevated rounded-xl p-4 flex gap-3 transition-all hover:scale-[1.01]",
                      !notif.isRead && "border-primary/20"
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-muted/20 to-muted/10 flex items-center justify-center flex-shrink-0">
                      {iconMap[notif.type] || <Bell size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={cn("text-sm font-medium truncate", !notif.isRead && "text-foreground", notif.isRead && "text-muted-foreground")}>
                          {notif.title}
                        </p>
                        {!notif.isRead && <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{notif.content}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTimeAgo(notif.createdAt)}</p>
                    </div>
                    {notif.isRead && <Check size={14} className="text-muted-foreground/30 flex-shrink-0 mt-1" />}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}