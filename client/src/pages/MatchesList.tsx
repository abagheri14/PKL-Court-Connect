import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName, formatTimeAgo } from "@/lib/avatarUtils";
import { Lock, Search, Loader2, Heart, Crown, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/QueryError";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function MatchesList() {
  const { selectMatch, selectPlayer, user, navigate } = useApp();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const matchesQuery = trpc.matches.list.useQuery(undefined, {
    refetchInterval: 15000,
    staleTime: 15000,
  });
  const matches = matchesQuery.data ?? [];

  // "Who Rallied You" — available for all users but blurred for non-premium
  const whoLikedQuery = trpc.swipes.whoLikedYou.useQuery(undefined, {
    enabled: !!user?.isPremium,
    refetchInterval: 30000,
  });
  const whoLiked: any[] = whoLikedQuery.data ?? [];

  if (matchesQuery.isLoading) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (matchesQuery.isError && !matchesQuery.data) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center">
        <QueryError message={t("matches.couldntLoadMatches")} onRetry={() => matchesQuery.refetch()} />
      </div>
    );
  }

  const filtered = matches.filter((m: any) => {
    if (!m.user) return false;
    if (!search) return true;
    return getDisplayName(m.user).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="pb-24 min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-pink-500/6 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3">
          <h1 className="text-xl font-bold tracking-tight mb-0.5">{t("matches.title")}</h1>
          <p className="text-[11px] text-muted-foreground mb-3">{t("matches.connectionCount", { count: matches.length })}</p>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("matches.searchPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background/50 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="px-5">
        {/* "Rallied You" section — blurred for non-premium */}
        {(whoLiked.length > 0 || !user?.isPremium) && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <Heart size={14} className="text-pink-400" />
                {t("matches.ralliedYou", "Rallied You")}
                {!user?.isPremium && <Crown size={11} className="text-secondary" />}
              </h2>
              {!user?.isPremium && (
                <Button onClick={() => navigate("premium")} size="sm" variant="outline" className="text-[10px] h-6 gap-1 border-secondary/30 text-secondary">
                  <Eye size={10} /> {t("matches.seeWho", "See Who")}
                </Button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {user?.isPremium ? (
                whoLiked.map((entry: any) => (
                  <button key={entry.id} onClick={() => selectPlayer(entry.user?.id ?? entry.swiperId)} className="flex-shrink-0 w-16 flex flex-col items-center gap-1">
                    <PlayerAvatar user={entry.user ?? { id: entry.swiperId, name: "?", hasProfilePhoto: false }} size="md" showBadges={false} />
                    <span className="text-[9px] text-muted-foreground font-medium truncate w-full text-center">{getDisplayName(entry.user ?? { name: "?" })}</span>
                  </button>
                ))
              ) : (
                // Blurred placeholder tiles for non-premium
                Array.from({ length: 4 }).map((_, i) => (
                  <button key={i} onClick={() => navigate("premium")} className="flex-shrink-0 w-16 flex flex-col items-center gap-1">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-[6px] ring-2 ring-pink-400/20" />
                    <span className="text-[9px] text-muted-foreground font-medium blur-sm">Player</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-12 animate-slide-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/10 flex items-center justify-center mx-auto mb-3">
              <Heart size={28} className="text-primary/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {matches.length === 0 ? t("matches.noMatchesYet") : t("matches.noMatchesFound")}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">{matches.length === 0 ? t("matches.startSwiping") : t("matches.tryDifferentSearch")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((match, i) => (
              <button
                key={match.id}
                onClick={() => selectMatch(match.id, match.conversationId)}
                className={cn("w-full card-elevated rounded-xl p-3.5 flex items-center gap-3.5 text-left transition-all active:scale-[0.98] hover:scale-[1.01] animate-slide-up",
                  i < 3 ? "delay-100" : "delay-200",
                  match.unreadCount > 0 && "border-primary/20"
                )}
              >
                <div
                  className="relative flex-shrink-0 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); selectPlayer(match.user.id); }}
                >
                  <PlayerAvatar user={match.user} size="md" showBadges={false} />
                  {match.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                      {match.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{getDisplayName(match.user)}</span>
                    <span className="text-[10px] text-muted-foreground">{match.lastMessageAt ? formatTimeAgo(String(match.lastMessageAt)) : ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Lock size={9} className="text-green-400 flex-shrink-0" />
                    <p className={cn("text-xs truncate", match.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {match.lastMessage || t("matches.sendFirstMessage")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
