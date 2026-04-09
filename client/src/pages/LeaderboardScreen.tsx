import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName } from "@/lib/avatarUtils";
import { getLevelInfo, getTierColor } from "@/lib/gamification";
import { useState } from "react";
import { ArrowLeft, Calendar, Crown, Flame, Medal, Star, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QueryError } from "@/components/QueryError";
import { useTranslation } from "react-i18next";

type LeaderboardTab = "xp" | "streak" | "games" | "wins";
type LeaderboardPeriod = "all" | "weekly";

export default function LeaderboardScreen() {
  const { navigate, goBack, user, selectPlayer } = useApp();
  const { t } = useTranslation();
  const [tab, setTab] = useState<LeaderboardTab>("xp");
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const leaderboardQuery = trpc.leaderboard.get.useQuery({ type: tab, limit: 50, period }, { refetchInterval: 30000 });
  const sorted: any[] = leaderboardQuery.data ?? [];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={18} className="text-secondary" />;
    if (rank === 2) return <Medal size={18} className="text-gray-300" />;
    if (rank === 3) return <Medal size={18} className="text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground w-[18px] text-center">{rank}</span>;
  };

  const getStatValue = (player: any) => {
    if (tab === "xp" && period === "weekly") return `${(player.weeklyXp ?? 0).toLocaleString()} XP`;
    if (tab === "xp") return `${(player.xp ?? 0).toLocaleString()} XP`;
    if (tab === "streak") return `${player.currentStreak ?? 0} days`;
    if (tab === "wins" && period === "weekly") return `${player.weeklyWins ?? 0} wins`;
    if (tab === "wins") return `${player.totalWins ?? 0} wins`;
    if (tab === "games" && period === "weekly") return `${player.weeklyGames ?? 0} games`;
    return `${player.totalGames ?? 0} games`;
  };

  const tabs: { key: LeaderboardTab; label: string; icon: typeof Trophy }[] = [
    { key: "xp", label: "XP", icon: Star },
    { key: "wins", label: "Wins", icon: Trophy },
    { key: "streak", label: "Streaks", icon: Flame },
    { key: "games", label: "Games", icon: Medal },
  ];

  // Top 3 for podium
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="pb-24 min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-secondary/8 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} aria-label="Go back" className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold flex-1 tracking-tight">{t("Leaderboard")}</h1>
        </div>
      </div>

      {/* Period Toggle */}
      <div className="px-5 mb-2 animate-slide-up">
          <div className="flex gap-1.5 bg-muted/10 rounded-xl p-1">
            {(["all", "weekly"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                  period === p ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                )}
              >
                {p === "weekly" && <Calendar size={12} />}
                {t(p === "all" ? "All Time" : "This Week")}
              </button>
            ))}
          </div>
        </div>

      {/* Tabs */}
      <div className="px-5 mb-3 animate-slide-up">
        <div className="flex gap-1.5">
          {tabs.map(tb => {
            const Icon = tb.icon;
            return (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  tab === tb.key ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                )}
              >
                <Icon size={14} />
                {t(tb.label)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Type */}

      {/* Podium */}
      {leaderboardQuery.isError && !sorted.length ? (
        <div className="px-5"><QueryError message={t("Failed to load leaderboard")} onRetry={() => leaderboardQuery.refetch()} /></div>
      ) : leaderboardQuery.isLoading && !sorted.length ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-muted-foreground/40" />
        </div>
      ) : (
      <>
      <div className="px-5 mb-6 animate-slide-up delay-200">
        <div className="flex items-end justify-center gap-3">
          {/* 2nd place */}
          {top3[1] && (
            <div className="flex flex-col items-center flex-1 cursor-pointer" onClick={() => selectPlayer(top3[1].id)}>
              <PlayerAvatar user={top3[1]} size="md" />
              <p className="text-xs font-bold mt-1 truncate max-w-full">{getDisplayName(top3[1]).split(" ")[0]}</p>
              <p className="text-[10px] text-muted-foreground">{getStatValue(top3[1])}</p>
              <div className="w-full h-16 card-elevated rounded-t-xl mt-2 flex items-center justify-center">
                <Medal size={24} className="text-gray-300" />
              </div>
            </div>
          )}
          {/* 1st place */}
          {top3[0] && (
            <div className="flex flex-col items-center flex-1 cursor-pointer" onClick={() => selectPlayer(top3[0].id)}>
              <div className="relative">
                <Crown size={20} className="text-secondary mx-auto mb-1" />
                <PlayerAvatar user={top3[0]} size="lg" />
              </div>
              <p className="text-sm font-bold mt-1 truncate max-w-full">{getDisplayName(top3[0]).split(" ")[0]}</p>
              <p className="text-xs text-secondary font-semibold">{getStatValue(top3[0])}</p>
              <div className="w-full h-24 card-gold rounded-t-xl mt-2 flex items-center justify-center">
                <Trophy size={28} className="text-secondary" />
              </div>
            </div>
          )}
          {/* 3rd place */}
          {top3[2] && (
            <div className="flex flex-col items-center flex-1 cursor-pointer" onClick={() => selectPlayer(top3[2].id)}>
              <PlayerAvatar user={top3[2]} size="md" />
              <p className="text-xs font-bold mt-1 truncate max-w-full">{getDisplayName(top3[2]).split(" ")[0]}</p>
              <p className="text-[10px] text-muted-foreground">{getStatValue(top3[2])}</p>
              <div className="w-full h-12 card-elevated rounded-t-xl mt-2 flex items-center justify-center">
                <Medal size={20} className="text-amber-600" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rankings List */}
      <div className="px-5 space-y-2">
        {rest.map((player, idx) => {
          const rank = idx + 4;
          const level = getLevelInfo(player.xp);
          const isMe = player.id === user?.id;
          return (
            <div
              key={player.id}
              onClick={() => selectPlayer(player.id)}
              className={cn("card-elevated rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
                isMe && "border-primary/25 bg-primary/5"
              )}
            >
              <div className="w-8 flex items-center justify-center">
                {getRankIcon(rank)}
              </div>
              <PlayerAvatar user={player} size="sm" showBadges={false} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold truncate">
                    {getDisplayName(player)}
                    {isMe && <span className="text-xs text-primary ml-1">({t("You")})</span>}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  <span style={{ color: getTierColor(level.tier) }}>Lv.{level.level}</span> {level.title}
                </p>
              </div>
              <span className="text-sm font-bold text-secondary">{getStatValue(player)}</span>
            </div>
          );
        })}
      </div>

      {/* Your Position (if scrolled past) */}
      {sorted.findIndex(p => p.id === user?.id) >= 3 && (
        <div className="fixed bottom-20 left-0 right-0 px-5">
          <div className="card-elevated rounded-xl p-3.5 flex items-center gap-3 border-primary/30 shadow-lg">
            <div className="w-8 flex items-center justify-center">
              {getRankIcon(sorted.findIndex(p => p.id === user?.id) + 1)}
            </div>
            <PlayerAvatar user={user} size="sm" showBadges={false} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{t("You")}</p>
            </div>
            <span className="text-sm font-bold text-secondary">{getStatValue(user)}</span>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
