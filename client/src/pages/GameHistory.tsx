import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Trophy, ChevronRight, Plus, Loader2, Star, Send, Filter, TrendingUp, Award, ChevronDown, BarChart3, Play, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlayerAvatar from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { QueryError } from "@/components/QueryError";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const TABS = ["upcoming", "in-progress", "past", "stats"] as const;
type TabKey = typeof TABS[number];

export default function GameHistory() {
  const { navigate, goBack, user, selectGame } = useApp();
  const { t, i18n } = useTranslation();
  const upcomingQuery = trpc.games.upcoming.useQuery(undefined, { refetchInterval: 15000 });
  const pastQuery = trpc.games.list.useQuery({ status: "completed" }, { refetchInterval: 30000 });
  const inProgressQuery = trpc.games.list.useQuery({ status: "in-progress" }, { refetchInterval: 10000 });
  const inProgressGames: any[] = inProgressQuery.data ?? [];
  const upcomingGamesRaw: any[] = upcomingQuery.data ?? [];
  // Sort: user's own games first, then open games
  const upcomingGames = useMemo(() => {
    const mine: any[] = [];
    const others: any[] = [];
    for (const g of upcomingGamesRaw) {
      const isParticipant = (g.participants ?? []).some((p: any) => p.userId === user?.id);
      const isOrganizer = g.organizerId === user?.id;
      if (isParticipant || isOrganizer) mine.push(g);
      else others.push(g);
    }
    return [...mine, ...others];
  }, [upcomingGamesRaw, user?.id]);
  const pastGames: any[] = pastQuery.data ?? [];
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [feedbackGameId, setFeedbackGameId] = useState<number | null>(null);
  const [feedbackReviewedId, setFeedbackReviewedId] = useState<number | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "rating">("date");
  const [gameView, setGameView] = useState<"mine" | "all">("all");
  const utils = trpc.useUtils();
  const feedbackMutation = trpc.games.giveFeedback.useMutation({
    onSuccess: () => { toast.success(t("gameHistory.feedbackSubmitted")); setFeedbackGameId(null); setFeedbackReviewedId(null); setFeedbackComment(""); setFeedbackRating(5); pastQuery.refetch(); utils.auth.me.invalidate(); },
    onError: (err) => { toast.error(err.message); setFeedbackGameId(null); setFeedbackReviewedId(null); },
  });
  const approveGameMutation = trpc.games.approveParticipant.useMutation({
    onSuccess: () => { toast.success(t("gameHistory.playerApproved")); upcomingQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const declineGameMutation = trpc.games.declineParticipant.useMutation({
    onSuccess: () => { toast(t("gameHistory.playerDeclined")); upcomingQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const joinGameMutation = trpc.games.join.useMutation({
    onSuccess: () => { toast.success(t("gameHistory.requestSent")); upcomingQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const confirmScoreMutation = trpc.games.confirmScore.useMutation({
    onSuccess: () => { toast.success(t("gameHistory.scoreConfirmed")); pastQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const disputeScoreMutation = trpc.games.disputeScore.useMutation({
    onSuccess: () => { toast(t("gameHistory.scoreDisputed")); pastQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const allGamesRaw = [...upcomingGames, ...pastGames];
  const seenGameIds = new Set<number>();
  const allGames = allGamesRaw.filter(g => { if (seenGameIds.has(g.id)) return false; seenGameIds.add(g.id); return true; });

  // Compute stats from past games
  const stats = useMemo(() => {
    const completed = pastGames.filter((g: any) => g.status === "completed" || g.status === "Completed");
    const gameTypes: Record<string, number> = {};
    const formats: Record<string, number> = {};
    const months: Record<string, number> = {};
    let totalDuration = 0;
    completed.forEach((g: any) => {
      gameTypes[g.gameType] = (gameTypes[g.gameType] || 0) + 1;
      formats[g.format] = (formats[g.format] || 0) + 1;
      // Use actual played duration (startedAt→completedAt) when available, else fall back to configured durationMinutes
      if (g.startedAt && g.completedAt) {
        const actualMinutes = Math.round((new Date(g.completedAt).getTime() - new Date(g.startedAt).getTime()) / 60000);
        totalDuration += Math.max(0, actualMinutes);
      } else {
        totalDuration += g.durationMinutes ?? 0;
      }
      const month = new Date(g.scheduledAt).toLocaleDateString(i18n.language, { month: "short", year: "2-digit" });
      months[month] = (months[month] || 0) + 1;
    });
    const favoriteType = Object.entries(gameTypes).sort(([,a],[,b]) => b - a)[0];
    const favoriteFormat = Object.entries(formats).sort(([,a],[,b]) => b - a)[0];
    return {
      total: allGames.length,
      completed: completed.length,
      upcoming: upcomingGames.length,
      cancelled: pastGames.filter((g: any) => g.status === "cancelled" || g.status === "Cancelled").length,
      avgDuration: completed.length ? Math.round(totalDuration / completed.length) : 0,
      totalHours: Math.round(totalDuration / 60),
      favoriteType: favoriteType?.[0] ?? "—",
      favoriteFormat: favoriteFormat?.[0] ?? "—",
      monthlyData: Object.entries(months).slice(-6),
    };
  }, [pastGames, upcomingGames, allGames]);

  const sortedPast = useMemo(() => {
    const sorted = [...pastGames];
    if (sortBy === "date") sorted.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    return sorted;
  }, [pastGames, sortBy]);

  const displayedUpcoming = useMemo(() => {
    if (gameView === "mine") {
      return upcomingGames.filter((g: any) => {
        const isParticipant = (g.participants ?? []).some((p: any) => p.userId === user?.id);
        return isParticipant || g.organizerId === user?.id;
      });
    }
    return upcomingGames;
  }, [upcomingGames, gameView, user?.id]);

  const displayed = activeTab === "upcoming" ? displayedUpcoming : activeTab === "in-progress" ? inProgressGames : activeTab === "past" ? sortedPast : [];

  return (
    <div className="pb-24 min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-secondary/8 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("gameHistory.title")}</h1>
          <Button
            onClick={() => navigate("createGame")}
            size="sm"
            className="ml-auto bg-gradient-to-r from-primary to-accent text-white text-xs gap-1 shadow-[0_0_16px_rgba(168,85,247,0.15)]"
          >
            <Plus size={14} /> {t("gameHistory.newGame")}
          </Button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="px-5 pb-4 animate-slide-up">
        <div className="card-hero rounded-xl p-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center relative z-10">
              <p className="stat-number text-xl text-secondary">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">{t("gameHistory.total")}</p>
            </div>
            <div className="text-center relative z-10">
              <p className="stat-number text-xl text-secondary">{stats.completed}</p>
              <p className="text-[10px] text-muted-foreground">{t("gameHistory.completed")}</p>
            </div>
            <div className="text-center relative z-10">
              <p className="stat-number text-xl text-accent">{stats.upcoming}</p>
              <p className="text-[10px] text-muted-foreground">{t("gameHistory.upcoming")}</p>
            </div>
            <div className="text-center relative z-10">
              <p className="stat-number text-xl text-primary">{stats.totalHours}h</p>
              <p className="text-[10px] text-muted-foreground">{t("gameHistory.played")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 pb-4 animate-slide-up delay-100">
        <div className="flex gap-1.5">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === tab ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}
            >
              {tab === "stats"
                ? t("gameHistory.tabStats")
                : tab === "in-progress"
                ? `${t("gameHistory.tabInProgress", "Live")} (${inProgressGames.length})`
                : `${tab === "upcoming" ? t("gameHistory.tabUpcoming") : t("gameHistory.tabPast")} (${tab === "upcoming" ? upcomingGames.length : pastGames.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* My Games / All Games sub-toggle for Upcoming tab */}
      {activeTab === "upcoming" && (
        <div className="px-5 pb-3">
          <div className="flex gap-2">
            <button onClick={() => setGameView("mine")}
              className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                gameView === "mine" ? "bg-secondary/20 text-secondary border border-secondary/30" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}
            >
              {t("gameHistory.myGames", "My Games")} ({displayedUpcoming.length})
            </button>
            <button onClick={() => setGameView("all")}
              className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                gameView === "all" ? "bg-secondary/20 text-secondary border border-secondary/30" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}
            >
              {t("gameHistory.allGames", "All Games")} ({upcomingGames.length})
            </button>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <div className="px-5 space-y-3 animate-slide-up">
          {/* Breakdown Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card-elevated rounded-xl p-3 text-center">
              <Trophy size={16} className="mx-auto text-secondary mb-1" />
              <p className="text-lg font-bold capitalize">{stats.favoriteType}</p>
              <p className="text-[10px] text-muted-foreground">{t("gameHistory.favoriteType")}</p>
            </div>
            <div className="card-elevated rounded-xl p-3 text-center">
              <Users size={16} className="mx-auto text-accent mb-1" />
              <p className="text-lg font-bold capitalize">{stats.favoriteFormat.replace("-", " ")}</p>
              <p className="text-[10px] text-muted-foreground">{t("gameHistory.favoriteFormat")}</p>
            </div>
            <div className="card-elevated rounded-xl p-3 text-center">
              <Clock size={16} className="mx-auto text-primary mb-1" />
              <p className="text-lg font-bold">{stats.avgDuration}m</p>
              <p className="text-[10px] text-muted-foreground">{t("gameHistory.avgDuration")}</p>
            </div>
            <div className="card-elevated rounded-xl p-3 text-center">
              <TrendingUp size={16} className="mx-auto text-secondary mb-1" />
              <p className="text-lg font-bold">{stats.cancelled}</p>
              <p className="text-[10px] text-muted-foreground">{t("gameHistory.cancelled")}</p>
            </div>
          </div>

          {/* Monthly Activity Chart */}
          {stats.monthlyData.length > 0 && (
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart3 size={14} className="text-secondary" /> {t("gameHistory.monthlyActivity")}
              </h3>
              <div className="flex items-end gap-2 h-24">
                {stats.monthlyData.map(([month, count]: [string, number]) => {
                  const maxCount = Math.max(...stats.monthlyData.map(([, c]: [string, number]) => c));
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] font-bold text-secondary">{count}</span>
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-primary to-secondary min-h-[4px]"
                        style={{ height: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}
                      />
                      <span className="text-[8px] text-muted-foreground">{month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Streaks & Milestones */}
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Award size={14} className="text-secondary" /> {t("gameHistory.milestones")}
            </h3>
            <div className="space-y-2">
              {[
                { label: t("gameHistory.firstGame"), reached: stats.completed >= 1, target: 1 },
                { label: t("gameHistory.10GamesPlayed"), reached: stats.completed >= 10, target: 10 },
                { label: t("gameHistory.50GamesPlayed"), reached: stats.completed >= 50, target: 50 },
                { label: t("gameHistory.100GamesPlayed"), reached: stats.completed >= 100, target: 100 },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold",
                    m.reached ? "bg-secondary/20 text-secondary" : "bg-muted/10 text-muted-foreground"
                  )}>
                    {m.reached ? "✓" : m.target}
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-xs font-medium", m.reached ? "text-foreground" : "text-muted-foreground")}>{m.label}</p>
                    <div className="w-full h-1 rounded-full bg-muted/20 mt-1">
                      <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min(100, (stats.completed / m.target) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Cards */}
      {activeTab !== "stats" && (
      <div className="px-5 space-y-2.5">
        {activeTab === "past" && pastGames.length > 0 && (
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => setSortBy("date")} className={cn("text-[10px] px-2 py-1 rounded-full border transition-all", sortBy === "date" ? "border-secondary bg-secondary/20 text-secondary" : "border-border text-muted-foreground")}>
              <Filter size={8} className="inline mr-1" />{t("gameHistory.newest")}
            </button>
          </div>
        )}
        {(upcomingQuery.isError || pastQuery.isError) && !displayed.length ? (
          <QueryError message={t("gameHistory.failedToLoadGames")} onRetry={() => { upcomingQuery.refetch(); pastQuery.refetch(); }} />
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 animate-slide-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/15 to-orange-500/10 flex items-center justify-center mx-auto mb-3">
              <Calendar size={28} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{t("gameHistory.noGames", { tab: activeTab })}</p>
            {activeTab === "upcoming" && (
              <Button onClick={() => navigate("createGame")} size="sm" className="mt-3 bg-secondary text-background text-xs">
                <Plus size={12} className="mr-1" /> {t("gameHistory.createFirstGame")}
              </Button>
            )}
          </div>
        ) : (
          displayed.map((game, i) => {
            const isExpanded = expandedGameId === game.id;
            return (
            <div key={game.id} className={cn("card-elevated rounded-xl animate-slide-up", i < 2 ? "delay-100" : "delay-200")}>
              <button onClick={() => setExpandedGameId(isExpanded ? null : game.id)} className="w-full text-left p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-sm capitalize">{t(`gameTypes.${game.gameType}`)} — {t(`gameFormats.${game.format}`)}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <MapPin size={10} className="text-secondary" />
                      <span>{game.courtName ?? game.locationName ?? "TBD"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("sport-badge text-[9px] py-0 capitalize",
                      (game.status === "completed" || game.status === "Completed") ? "sport-badge-green" :
                      (game.status === "cancelled" || game.status === "Cancelled") ? "sport-badge-red" :
                      "sport-badge-gold"
                    )}>{game.status}</span>
                    <ChevronDown size={12} className={cn("text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                  </div>
                </div>

                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar size={10} className="text-primary" /> {new Date(game.scheduledAt).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {new Date(game.scheduledAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}</span>
                  <span className="flex items-center gap-1"><Users size={10} /> {game.currentPlayers}/{game.maxPlayers}</span>
                </div>
              </button>

              {/* Quick-access Continue button for in-progress games (visible without expanding) */}
              {activeTab === "in-progress" && game.status === "in-progress" && (game.organizerId === user?.id || (game.participants ?? []).some((p: any) => p.userId === user?.id && p.status === "confirmed")) && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => selectGame(game.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 text-white text-xs font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                  >
                    <Play size={14} />
                    {t("gamePlay.continueGame", "Continue Game")}
                  </button>
                </div>
              )}

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3 animate-slide-up">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock size={10} className="text-primary" />
                      <span>{t("gameHistory.duration", { count: game.startedAt && game.completedAt ? Math.round((new Date(game.completedAt).getTime() - new Date(game.startedAt).getTime()) / 60000) : game.durationMinutes })}</span>
                    </div>
                    {game.skillLevelMin && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <TrendingUp size={10} className="text-secondary" />
                        <span>{t("gameHistory.skill", { min: game.skillLevelMin, max: game.skillLevelMax ?? game.skillLevelMin })}</span>
                      </div>
                    )}
                  </div>
                  {game.notes && (
                    <p className="text-[11px] text-muted-foreground/80 italic">&ldquo;{game.notes}&rdquo;</p>
                  )}
                  {/* Participants */}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">{t("gameHistory.participants")}</p>
                    <div className="flex items-center flex-wrap">
                      {(game.participants ?? []).filter((p: any) => p.status === "confirmed").map((p: any, i: number) => (
                        <div key={i} className="-ml-1.5 first:ml-0">
                          <PlayerAvatar user={{ id: p.userId, name: p.name, profilePhotoUrl: p.profilePhotoUrl, hasProfilePhoto: !!p.profilePhotoUrl }} size="sm" showBadges={false} />
                        </div>
                      ))}
                      {game.currentPlayers < game.maxPlayers && activeTab === "upcoming" && (
                        <div className="w-8 h-8 rounded-lg border-2 border-dashed border-secondary/30 flex items-center justify-center text-[10px] text-secondary ml-1.5">+</div>
                      )}
                    </div>
                    {/* Pending participants — only visible to organizer or confirmed participants */}
                    {(game.organizerId === user?.id || (game.participants ?? []).some((p: any) => p.userId === user?.id && p.status === "confirmed")) && (game.participants ?? []).some((p: any) => p.status === "pending") && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[9px] text-amber-400 font-semibold">{t("common.pendingRequests")}</p>
                        {(game.participants ?? []).filter((p: any) => p.status === "pending").map((p: any) => (
                          <div key={p.userId} className="flex items-center gap-2 p-1.5 rounded-lg bg-amber-400/5 border border-amber-400/15">
                            <PlayerAvatar user={{ id: p.userId, name: p.name, profilePhotoUrl: p.profilePhotoUrl, hasProfilePhoto: !!p.profilePhotoUrl }} size="xs" showBadges={false} />
                            <span className="text-[10px] font-medium flex-1">{p.name || `User #${p.userId}`}</span>
                            {game.organizerId === user?.id ? (
                              <div className="flex gap-1">
                                <button onClick={(e) => { e.stopPropagation(); approveGameMutation.mutate({ gameId: game.id, userId: p.userId }); }}
                                  className="px-2 py-0.5 rounded bg-secondary/20 text-secondary text-[9px] font-bold">{t("common.approve")}</button>
                                <button onClick={(e) => { e.stopPropagation(); declineGameMutation.mutate({ gameId: game.id, userId: p.userId }); }}
                                  className="px-2 py-0.5 rounded bg-muted/30 text-muted-foreground text-[9px] font-bold">{t("common.decline")}</button>
                              </div>
                            ) : p.userId === user?.id ? (
                              <span className="text-[9px] text-amber-400">{t("common.awaiting")}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Join button for upcoming games */}
                    {activeTab === "upcoming" && game.isOpen && !(game.participants ?? []).some((p: any) => p.userId === user?.id) && game.organizerId !== user?.id && (
                      <button onClick={(e) => { e.stopPropagation(); joinGameMutation.mutate({ gameId: game.id }); }}
                        className="mt-2 text-[11px] text-secondary font-bold hover:text-secondary/80 transition-colors"
                        disabled={joinGameMutation.isPending}>
                        {joinGameMutation.isPending ? t("common.requesting") : t("common.requestToJoin")}
                      </button>
                    )}
                    {/* Start / Continue game for organizer or confirmed participant */}
                    {(activeTab === "upcoming" || activeTab === "in-progress") && (game.organizerId === user?.id || (game.participants ?? []).some((p: any) => p.userId === user?.id && p.status === "confirmed")) && (game.status === "scheduled" || game.status === "in-progress") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); selectGame(game.id); }}
                        className={cn(
                          "mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-bold transition-all hover:opacity-90 active:scale-[0.97]",
                          game.status === "in-progress" ? "bg-gradient-to-r from-green-600 to-green-500" : "bg-gradient-to-r from-primary to-secondary"
                        )}
                      >
                        <Play size={14} />
                        {game.status === "in-progress" ? t("gamePlay.continueGame", "Continue Game") : t("gamePlay.startGame")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Score confirmation for completed games */}
              {(game.status === "completed" || game.status === "Completed") && game.result && (
                <div className="px-4 pb-2">
                  <div className="p-2.5 rounded-xl bg-muted/10 border border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Score: {game.result.team1Score} - {game.result.team2Score}</span>
                      {game.result.scoreDisputed && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">{t("gameHistory.disputed")}</span>
                      )}
                    </div>
                    {(() => {
                      const confirmed: number[] = game.result.scoreConfirmedBy ?? [];
                      const isConfirmed = confirmed.includes(user?.id ?? 0);
                      const isParticipant = (game.participants ?? []).some((p: any) => p.userId === user?.id);
                      if (!isParticipant) return null;
                      if (isConfirmed) {
                        return <p className="text-[10px] text-green-400 font-medium flex items-center gap-1"><Check size={10} /> {t("gameHistory.youConfirmed", { count: confirmed.length })}</p>;
                      }
                      return (
                        <div className="flex gap-1.5 mt-1">
                          <Button size="sm" className="text-[10px] flex-1 bg-green-600 text-white h-7" disabled={confirmScoreMutation.isPending || disputeScoreMutation.isPending} onClick={() => confirmScoreMutation.mutate({ gameId: game.id })}>
                            <Check size={10} className="mr-1" /> {t("gameHistory.confirmScore")}
                          </Button>
                          <Button size="sm" variant="outline" className="text-[10px] flex-1 border-red-500/30 text-red-400 h-7" disabled={confirmScoreMutation.isPending || disputeScoreMutation.isPending} onClick={() => disputeScoreMutation.mutate({ gameId: game.id })}>
                            <X size={10} className="mr-1" /> {t("gameHistory.dispute")}
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Feedback for completed games */}
              {(game.status === "completed" || game.status === "Completed") && (
                <div className="px-4 pb-4">
                {feedbackGameId === game.id ? (
                  <div className="p-3 rounded-xl bg-background/30 border border-border space-y-2">
                    {/* Participant selector */}
                    {(() => {
                      const others = (game.participants ?? []).filter((p: any) => p.userId !== user?.id);
                      return others.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {others.map((p: any) => (
                            <button
                              key={p.userId}
                              onClick={() => setFeedbackReviewedId(p.userId)}
                              className={cn("px-2 py-1 rounded-full text-xs border transition-colors", feedbackReviewedId === p.userId ? "border-secondary bg-secondary/20 text-secondary" : "border-border text-muted-foreground")}
                            >
                              {p.name ?? t("common.player")}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => setFeedbackRating(star)}>
                          <Star size={18} className={cn("transition-colors", star <= feedbackRating ? "text-secondary fill-secondary" : "text-muted-foreground/30")} />
                        </button>
                      ))}
                      <span className="text-xs text-muted-foreground ml-2">{feedbackRating}/5</span>
                    </div>
                    <textarea
                      value={feedbackComment}
                      onChange={e => setFeedbackComment(e.target.value)}
                      placeholder={t("common.howWasTheGame")}
                      className="w-full bg-background/50 rounded-lg p-2 text-xs border border-border min-h-[50px] resize-none focus:outline-none focus:border-secondary"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const targetId = feedbackReviewedId;
                          if (!targetId) {
                            // Auto-select the first other player if none selected
                            const others = (game.participants ?? []).filter((p: any) => p.userId !== user?.id);
                            if (others.length === 1) {
                              feedbackMutation.mutate({ gameId: game.id, reviewedId: others[0].userId, rating: feedbackRating, comment: feedbackComment || undefined });
                              return;
                            }
                            toast.error(t("common.noPlayerToReview"));
                            return;
                          }
                          feedbackMutation.mutate({ gameId: game.id, reviewedId: targetId, rating: feedbackRating, comment: feedbackComment || undefined });
                        }}
                        disabled={feedbackMutation.isPending}
                        className="bg-secondary text-background text-xs flex-1"
                      >
                        <Send size={12} className="mr-1" /> {feedbackMutation.isPending ? t("common.submitting") : t("common.submit")}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setFeedbackGameId(null)}>{t("common.cancel")}</Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs w-full border-secondary/30 text-secondary"
                    onClick={() => setFeedbackGameId(game.id)}
                  >
                    <Star size={12} className="mr-1" /> {t("common.ratePlayers")}
                  </Button>
                )}
                </div>
              )}
            </div>
          );})
        )}
      </div>
      )}
    </div>
  );
}
