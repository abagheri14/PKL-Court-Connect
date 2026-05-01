import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName, formatTimeAgo } from "@/lib/avatarUtils";
import { getLevelInfo, getLevelProgress, getTierColor } from "@/lib/gamification";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";
import PKLBallLogo from "@/components/PKLBallLogo";
import {
  Bell, Calendar, Check, ChevronRight, Crown, Flame, Gift, GraduationCap, MapPin, MessageCircle,
  Star, Swords, Target, Trophy, Users, Zap, Loader2, TrendingUp, Award, Activity,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function HomeDashboard() {
  const { t, i18n } = useTranslation();
  const { user, navigate, selectMatch, setActiveTab, refetchUser } = useApp();

  const matchesQuery = trpc.matches.list.useQuery(undefined, { refetchInterval: 30000 });
  const gamesQuery = trpc.games.upcoming.useQuery(undefined, { refetchInterval: 30000 });
  const completedGamesQuery = trpc.games.list.useQuery({ status: "completed" }, { refetchInterval: 30000 });
  const achievementsQuery = trpc.achievements.list.useQuery(undefined, { refetchInterval: 60000 });
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { refetchInterval: 15000 });
  const leaderboardQuery = trpc.leaderboard.get.useQuery({ type: "xp", limit: 50 }, { refetchInterval: 60000 });
  const todayClaimsQuery = trpc.achievements.todayClaims.useQuery(undefined, { refetchInterval: 30000 });
  const joinGameMutation = trpc.games.join.useMutation({
      onSuccess: () => { gamesQuery.refetch(); toast.success(t("home.requestSent")); },
      onError: (err) => toast.error(err.message),
  });
  const claimQuestMutation = trpc.achievements.claimQuest.useMutation({
    onSuccess: () => { refetchUser(); todayClaimsQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const matches = matchesQuery.data ?? [];
  const allUpcomingGames = gamesQuery.data ?? [];
  const completedGames = completedGamesQuery.data ?? [];
  // Home page: only show games the user has joined or organized
  const upcomingGames = allUpcomingGames.filter((g: any) =>
    g.organizerId === user?.id || (g.participants ?? []).some((p: any) => p.userId === user?.id)
  );
  const achievements = achievementsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];
  const leaderboard = leaderboardQuery.data ?? [];
  const unreadNotifCount = notifications.filter(n => !n.isRead).length;

  if (!user) return null;

  const hasError = matchesQuery.isError || gamesQuery.isError || completedGamesQuery.isError || achievementsQuery.isError || leaderboardQuery.isError;
  if (hasError && !matchesQuery.data && !gamesQuery.data && !completedGamesQuery.data) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center">
        <QueryError
            message={t("home.errorLoadDashboard")}
          onRetry={() => { matchesQuery.refetch(); gamesQuery.refetch(); completedGamesQuery.refetch(); achievementsQuery.refetch(); leaderboardQuery.refetch(); }}
        />
      </div>
    );
  }

  const levelInfo = getLevelInfo(user.xp);
  const levelProgress = getLevelProgress(user.xp);
  const earnedAchievements = achievements.filter(a => a.earnedAt);
  const userRankIndex = leaderboard.findIndex((p: any) => p.id === user.id);
  const userRank = userRankIndex >= 0 ? `#${userRankIndex + 1}` : "—";

  const claimedQuests = todayClaimsQuery.data ?? [];
  const xpMultiplier = user.isPremium ? 2 : 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sentMessageToday = matches.some(m => m.lastMessageAt && new Date(m.lastMessageAt) >= today);
  const gamesCompletedToday = completedGames.filter((g: any) => g.completedAt && new Date(g.completedAt) >= today).length;
  const dailyQuests = [
    { id: "q1", title: t("quests.dailyLogin"), desc: t("quests.dailyLoginDesc"), xp: 50 * xpMultiplier, icon: Flame, progress: 1, max: 1, done: true },
    { id: "q2", title: t("quests.swipe5Players"), desc: t("quests.swipe5PlayersDesc"), xp: 30 * xpMultiplier, icon: Zap, progress: Math.min(5, user.swipesUsedToday || 0), max: 5, done: (user.swipesUsedToday || 0) >= 5 },
    { id: "q3", title: t("quests.sendMessage"), desc: t("quests.sendMessageDesc"), xp: 25 * xpMultiplier, icon: MessageCircle, progress: sentMessageToday ? 1 : 0, max: 1, done: sentMessageToday },
    { id: "q4", title: t("quests.playGame"), desc: t("quests.playGameDesc"), xp: 100 * xpMultiplier, icon: Swords, progress: Math.min(1, gamesCompletedToday), max: 1, done: gamesCompletedToday >= 1 },
  ];
  const questsDone = dailyQuests.filter(q => q.done).length;

  return (
    <div className="pb-24 min-h-screen">

      {/* ═══ HERO HEADER ═══ */}
      <div className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-secondary/5 blur-2xl" style={{ animationDelay: '2s' }} />

        <div className="relative px-5 pt-7 pb-5">
          {/* Top bar with logo and bell */}
          <div className="flex items-center justify-between mb-4">
            <PKLBallLogo size="sm" variant="dark" className="mx-0" />
            <button
              onClick={() => navigate("notifications")}
              className="relative p-2.5 rounded-xl glass transition-all hover:scale-105"
            >
              <Bell size={20} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3.5 mb-5">
            <div className="relative">
              <PlayerAvatar user={user} size="md" />
              {/* Online ring */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-background" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground/70 font-medium tracking-wide uppercase">{t("home.welcomeBack")}</p>
              <h1 className="text-xl font-bold tracking-tight">{getDisplayName(user)}</h1>
            </div>
          </div>

          {/* Level Card - Hero variant */}
          <div className="card-hero p-4 animate-slide-up">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${getTierColor(levelInfo.tier)}18` }}>
                    <span className="text-base font-black stat-number" style={{ color: getTierColor(levelInfo.tier) }}>
                      {levelInfo.level}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{levelInfo.title}</p>
                    <span className="sport-badge sport-badge-purple text-[10px] py-0.5 px-2">{levelInfo.tier}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black stat-number text-gradient-gold">{user.xp.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{t("home.xpTotal")}</p>
                </div>
              </div>
              <div className="relative">
                <Progress value={levelProgress} className="h-2.5 progress-animated" />
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Flame size={12} className="text-secondary" />
                    <span className="text-secondary font-semibold">{t("home.dayStreak", { count: user.currentStreak })}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {levelInfo.maxXp !== Infinity ? t("home.xpToNext", { count: (levelInfo.maxXp - user.xp).toLocaleString() }) : t("home.max")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BENTO STAT GRID ═══ */}
      <div className="px-5 mb-5 animate-slide-up delay-100">
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { icon: Users, label: t("home.statMatches"), value: user.totalMatches, color: "text-primary", bg: "from-primary/15 to-primary/5" },
              { icon: Calendar, label: t("home.statUpcoming"), value: upcomingGames.length, color: "text-secondary", bg: "from-secondary/15 to-secondary/5" },
              { icon: Trophy, label: t("home.statTrophies"), value: earnedAchievements.length, color: "text-secondary", bg: "from-secondary/15 to-secondary/5" },
              { icon: Crown, label: t("home.statRank"), value: userRank, color: "text-primary", bg: "from-primary/15 to-primary/5", onClick: () => navigate("leaderboard") },
          ].map((stat, i) => {
            const Comp = stat.onClick ? 'button' : 'div';
            return (
              <Comp
                key={stat.label}
                onClick={stat.onClick}
                className={`card-elevated rounded-xl p-3 text-center transition-transform hover:scale-[1.02] ${stat.onClick ? 'active:scale-[0.97]' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-gradient-to-br ${stat.bg}`}>
                  <stat.icon size={16} className={stat.color} />
                </div>
                <p className="text-lg font-black stat-number">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
              </Comp>
            );
          })}
        </div>
      </div>

      {/* ═══ DAILY QUESTS ═══ */}
      <div className="px-5 mb-5 animate-slide-up delay-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-orange-500/10 flex items-center justify-center">
              <Target size={14} className="text-secondary" />
            </div>
            {t("home.dailyQuests")}
              {user.isPremium && <span className="sport-badge sport-badge-gold text-[9px] py-0">{t("home.2xXp")}</span>}
          </h2>
          <span className="text-[11px] text-muted-foreground font-medium">{questsDone}/{dailyQuests.length}</span>
        </div>
        <div className="space-y-2">
          {dailyQuests.map(quest => {
            const QIcon = quest.icon;
            const claimed = claimedQuests.includes(quest.id);
            return (
              <div key={quest.id} className="card-neon rounded-xl p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  quest.done ? "bg-gradient-to-br from-green-500/20 to-emerald-600/10" : "bg-muted/20"
                }`}>
                  <QIcon size={18} className={quest.done ? "text-green-400" : "text-muted-foreground"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${quest.done && claimed ? "line-through text-muted-foreground" : ""}`}>{quest.title}</p>
                    <span className="sport-badge sport-badge-gold text-[10px] py-0 px-1.5">+{quest.xp}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-secondary to-orange-400 transition-all duration-500" style={{ width: `${(quest.progress / quest.max) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{quest.progress}/{quest.max}</span>
                  </div>
                </div>
                {quest.done && !claimed && (
                  <button
                    onClick={() => {
                      claimQuestMutation.mutate({ questId: quest.id, xp: quest.xp }, {
                          onSuccess: () => toast.success(t("home.xpClaimed", { xp: quest.xp })),
                        onError: (err) => toast.error(err.message),
                      });
                    }}
                    disabled={claimQuestMutation.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-secondary to-orange-400 text-secondary-foreground font-bold flex-shrink-0 shadow-[0_0_12px_rgba(255,215,0,0.2)] hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-shadow"
                  >
                    {t("home.claim")}
                  </button>
                )}
                {claimed && <Check size={18} className="text-green-400 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ QUICK ACTIONS — BENTO GRID ═══ */}
      <div className="px-5 mb-5 animate-slide-up delay-300">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Activity size={14} className="text-primary" />
          </div>
          {t("home.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setActiveTab("swipe")}
            className="card-neon rounded-xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-primary/15 flex items-center justify-center mb-3 group-hover:shadow-[0_0_16px_rgba(168,85,247,0.2)] transition-shadow">
              <Zap size={22} className="text-primary" />
            </div>
            <h3 className="font-bold text-sm">{t("home.swipeDeck")}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("home.swipeDeckDesc")}</p>
          </button>

          <button
            onClick={() => setActiveTab("nearby")}
            className="card-neon rounded-xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-secondary/25 to-secondary/15 flex items-center justify-center mb-3 group-hover:shadow-[0_0_16px_rgba(6,182,212,0.2)] transition-shadow">
              <MapPin size={22} className="text-secondary" />
            </div>
            <h3 className="font-bold text-sm">{t("home.nearby")}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("home.nearbyDesc")}</p>
          </button>

          <button
            onClick={() => navigate("courts")}
            className="card-neon rounded-xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500/25 to-emerald-500/15 flex items-center justify-center mb-3 group-hover:shadow-[0_0_16px_rgba(34,197,94,0.2)] transition-shadow">
              <MapPin size={22} className="text-green-300" />
            </div>
            <h3 className="font-bold text-sm">{t("home.findCourts")}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("home.findCourtsDesc")}</p>
          </button>

          <button
            onClick={() => navigate("gameHistory")}
            className="card-neon rounded-xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-primary/15 flex items-center justify-center mb-3 group-hover:shadow-[0_0_16px_rgba(249,115,22,0.2)] transition-shadow">
              <Swords size={22} className="text-primary" />
            </div>
            <h3 className="font-bold text-sm">{t("home.games")}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("home.gamesDesc")}</p>
          </button>
        </div>

        {/* Full-width action cards */}
        <div className="mt-2.5 space-y-2.5">
          <button
            onClick={() => navigate("tournaments")}
            className="card-gold rounded-xl p-4 text-left w-full flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFC107]/30 to-[#FF9800]/20 flex items-center justify-center flex-shrink-0 group-hover:shadow-[0_0_16px_rgba(255,193,7,0.3)] transition-shadow">
              <Trophy size={22} className="text-[#FFC107]" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">Tournaments</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Compete in brackets & round-robins</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => navigate("groups")}
              className="card-elevated rounded-xl p-3.5 text-left flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                <Users size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-xs">{t("home.groups")}</h3>
                  <p className="text-[10px] text-muted-foreground">{t("home.groupsDesc")}</p>
              </div>
            </button>

            <button
              onClick={() => navigate("coaching")}
              className="card-elevated rounded-xl p-3.5 text-left flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={18} className="text-secondary" />
              </div>
              <div>
                <h3 className="font-bold text-xs">{t("home.coaching")}</h3>
                  <p className="text-[10px] text-muted-foreground">{t("home.coachingDesc")}</p>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-2.5">
            <button
              onClick={() => navigate("activityFeed")}
              className="card-elevated rounded-xl p-3 text-center transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#BFFF00]/20 to-[#BFFF00]/10 flex items-center justify-center mx-auto mb-1.5">
                <Activity size={18} className="text-[#BFFF00]" />
              </div>
              <h3 className="font-bold text-[10px]">Feed</h3>
            </button>
            <button
              onClick={() => navigate("favoritePlayers")}
              className="card-elevated rounded-xl p-3 text-center transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-500/10 flex items-center justify-center mx-auto mb-1.5">
                <Star size={18} className="text-pink-400" />
              </div>
              <h3 className="font-bold text-[10px]">Favorites</h3>
            </button>
            <button
              onClick={() => navigate("referrals")}
              className="card-elevated rounded-xl p-3 text-center transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FFC107]/20 to-[#FFC107]/10 flex items-center justify-center mx-auto mb-1.5">
                <Gift size={18} className="text-[#FFC107]" />
              </div>
              <h3 className="font-bold text-[10px]">Referrals</h3>
            </button>
          </div>
        </div>
      </div>

      <div className="section-divider mx-5" />

      {/* ═══ UPCOMING GAMES ═══ */}
      {upcomingGames.length > 0 && (
        <div className="px-5 mb-5 animate-slide-up delay-400">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
                <Calendar size={14} className="text-secondary" />
              </div>
              {t("home.upcomingGames")}
            </h2>
            <button onClick={() => navigate("gameHistory")} className="text-[11px] text-secondary font-semibold hover:text-secondary/80 transition-colors">{t("home.viewAll")}</button>
          </div>
          <div className="space-y-2.5">
            {upcomingGames.slice(0, 3).map(game => (
              <div key={game.id} className="card-elevated rounded-xl p-4">
                <div className="flex items-start justify-between mb-2.5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`sport-badge text-[10px] py-0 ${
                        game.gameType === "casual" ? "sport-badge-green" : game.gameType === "competitive" ? "sport-badge-red" : "sport-badge-purple"
                      }`}>
                        {t(`gameTypes.${game.gameType}`)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t(`gameFormats.${game.format}`)}</span>
                    </div>
                    <h3 className="font-semibold text-sm">{game.locationName || t("common.tbd")}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-secondary" />
                    {new Date(game.scheduledAt).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span>{new Date(game.scheduledAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}</span>
                  <span className="font-medium">{game.currentPlayers}/{game.maxPlayers} {t("common.players")}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                  {game.participants.filter((p: any) => p.status === "confirmed").slice(0, 4).map((p: any, i: number) => (
                    <div key={i} className="-ml-1.5 first:ml-0">
                      <PlayerAvatar user={{ id: p.userId, name: p.name, profilePhotoUrl: p.profilePhotoUrl, hasProfilePhoto: !!p.profilePhotoUrl }} size="sm" showBadges={false} />
                    </div>
                  ))}
                  {game.isOpen && !game.participants.some((p: any) => p.userId === user.id) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); joinGameMutation.mutate({ gameId: game.id }); }}
                      className="text-[11px] text-secondary font-bold ml-2 hover:text-secondary/80 transition-colors"
                    >
                      {t("home.join")}
                    </button>
                  )}
                  {game.participants.some((p: any) => p.userId === user.id && p.status === "pending") && (
                    <span className="text-[10px] text-amber-400 font-semibold ml-2">{t("home.pendingApproval")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ RECENT MATCHES ═══ */}
      {matches.length > 0 && (
        <div className="px-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <MessageCircle size={14} className="text-primary" />
              </div>
              {t("home.recentMatches")}
            </h2>
            <button onClick={() => setActiveTab("matches")} className="text-[11px] text-secondary font-semibold hover:text-secondary/80 transition-colors">{t("home.viewAll")}</button>
          </div>
          <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
            {matches.map(match => (
              <button
                key={match.id}
                onClick={() => selectMatch(match.id, match.conversationId)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
              >
                <div className="relative">
                  <PlayerAvatar user={match.user} size="md" showBadges={false} />
                  {match.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 shadow-[0_0_6px_rgba(239,68,68,0.4)]">
                      {match.unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors font-medium">{getDisplayName(match.user).split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ PREMIUM CTA ═══ */}
      {!user.isPremium && (
        <div className="px-5 mb-5">
          <button
            onClick={() => navigate("premium")}
            className="w-full card-gold rounded-xl p-4 flex items-center gap-4 text-left animate-border-glow transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/30 to-secondary/20 flex items-center justify-center flex-shrink-0 shimmer">
              <Crown size={24} className="text-secondary drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-secondary text-sm">{t("home.goPremium")}</h3>
                <p className="text-[11px] text-muted-foreground">{t("home.goPremiumDesc")}</p>
            </div>
            <ChevronRight size={20} className="text-secondary/60" />
          </button>
        </div>
      )}
    </div>
  );
}
