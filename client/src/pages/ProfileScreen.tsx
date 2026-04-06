import { useTranslation } from "react-i18next";
import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName, getSkillLevelColor, getVibeColor } from "@/lib/avatarUtils";
import { getLevelInfo, getLevelProgress, getTierColor } from "@/lib/gamification";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight, Clock, Crown, Edit, Flame, GraduationCap, HelpCircle, Lock, LogOut,
  MapPin, Settings, Shield, Star, Trophy, Users, Gamepad2, TrendingUp, Gift,
} from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { useState } from "react";
import { toast } from "sonner";

export default function ProfileScreen() {
  const { user, navigate, logout } = useApp();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const achievementsQuery = trpc.achievements.list.useQuery(undefined, { refetchInterval: 60000 });
  const achievements = achievementsQuery.data ?? [];
  const endorsementsQuery = trpc.users.getEndorsements.useQuery(
    { userId: user?.id },
    { enabled: !!user?.id, refetchInterval: 30000 }
  );
  const endorsements = endorsementsQuery.data ?? [];
  const levelInfo = getLevelInfo(user?.xp ?? 0);
  const levelProgress = getLevelProgress(user?.xp ?? 0);
  const earnedAchievements = achievements.filter((a: any) => a.earnedAt);
  const unclaimedAchievements = earnedAchievements.filter((a: any) => !a.claimedAt);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const claimMutation = trpc.achievements.claim.useMutation({
    onSuccess: (data: any) => {
      achievementsQuery.refetch();
      utils.auth.me.invalidate();
      toast.success(t("profile.xpClaimed", { xp: data.xpAwarded }));
    },
    onError: (err) => toast.error(err.message),
  });

  const handleClaim = (achievementId: number) => {
    setClaimingId(achievementId);
    claimMutation.mutate({ achievementId }, {
      onSettled: () => setTimeout(() => setClaimingId(null), 600),
    });
  };

  return (
    <div className="pb-24 min-h-screen">
      {/* Profile Header */}
      <div className="relative overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full bg-primary/15 blur-[100px]" />
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/8 blur-3xl animate-float" />

        <div className="relative px-5 pt-8 pb-5 text-center">
          <div className="mb-4">
            <PlayerAvatar user={user} size="xl" className="mx-auto" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{getDisplayName(user)}</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">@{user?.username}</p>
          {user?.isPremium && (
            <span className="inline-flex items-center gap-1.5 text-xs text-secondary mt-2 sport-badge sport-badge-gold py-0.5 px-3">
              <Crown size={11} className="fill-secondary" /> {t("profile.premiumMember")}
            </span>
          )}
        </div>
      </div>

      {/* Level Card */}
      <div className="px-5 mb-4 animate-slide-up">
        <div className="card-hero rounded-xl p-4">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${getTierColor(levelInfo.tier)}18` }}>
                  <span className="text-lg font-black stat-number" style={{ color: getTierColor(levelInfo.tier) }}>{levelInfo.level}</span>
                </div>
                <div>
                  <p className="text-sm font-bold">{levelInfo.title}</p>
                  <span className="sport-badge sport-badge-purple text-[10px] py-0 px-2">{levelInfo.tier}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black stat-number text-gradient-gold">{(user?.xp ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{t("profile.xpTotal")}</p>
              </div>
            </div>
            <Progress value={levelProgress} className="h-2.5 progress-animated" />
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <Flame size={12} className="text-secondary" />
                <span className="text-secondary font-semibold">{t("profile.dayStreak", { count: user?.currentStreak ?? 0 })}</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-muted-foreground">{t("profile.best", { count: user?.longestStreak ?? 0 })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-5 mb-4 animate-slide-up delay-100">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="card-elevated rounded-xl p-3.5 text-center">
            <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
              <Gamepad2 size={16} className="text-primary" />
            </div>
            <p className="text-xl font-black stat-number">{user?.totalGames ?? 0}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{t("profile.games")}</p>
          </div>
          <div className="card-elevated rounded-xl p-3.5 text-center">
            <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
              <Trophy size={16} className="text-primary" />
            </div>
            <p className="text-xl font-black stat-number">{user?.totalWins ?? 0}<span className="text-xs text-muted-foreground font-normal">/{user?.totalLosses ?? 0}</span></p>
            <p className="text-[10px] text-muted-foreground font-medium">{t("profile.winLoss")}</p>
          </div>
          <div className="card-elevated rounded-xl p-3.5 text-center">
            <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-gradient-to-br from-secondary/15 to-secondary/5">
              <Star size={16} className="text-secondary fill-secondary" />
            </div>
            <p className="text-xl font-black stat-number">{Number(user?.averageRating ?? 0).toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{t("profile.rating")}</p>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="px-5 mb-4 animate-slide-up delay-200">
        <div className="card-elevated rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="sport-badge sport-badge-purple text-[10px] capitalize">{user.skillLevel}</span>
            <span className="sport-badge sport-badge-cyan text-[10px] capitalize">{user.vibe}</span>
            <span className="sport-badge text-[10px] capitalize">✋ {user.handedness}</span>
          </div>
          {user.bio && <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>}
          {user.playStyle && (
            <div className="flex flex-wrap gap-1.5">
              {String(user.playStyle).split(",").map(s => s.trim()).filter(Boolean).map((s: string) => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium border border-accent/15">{s}</span>
              ))}
            </div>
          )}
          {user.goals && (
            <div className="flex flex-wrap gap-1.5">
              {String(user.goals).split(",").map(g => g.trim()).filter(Boolean).map((g: string) => (
                <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium border border-secondary/15">{g}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Endorsements */}
      {endorsements.length > 0 && (
        <div className="px-5 mb-4">
          <h2 className="font-bold text-sm mb-2.5 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
              <Star size={14} className="text-secondary" />
            </div>
            {t("profile.endorsements")}
          </h2>
          <div className="card-elevated rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3">
              {endorsements.map((e: any) => (
                <div key={e.type} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary/15 to-orange-500/5 flex items-center justify-center">
                    <Star size={14} className="text-secondary fill-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize">{e.type.replace(/-/g, " ")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("profile.endorsementCount", { count: e.count })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Achievements Preview */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Trophy size={14} className="text-primary" />
            </div>
            {t("profile.achievements")}
          </h2>
          <button onClick={() => navigate("achievements")} className="text-[11px] text-secondary font-semibold hover:text-secondary/80 transition-colors">{t("profile.viewAll")}</button>
        </div>
        {achievementsQuery.isError ? (
          <QueryError message={t("profile.failedLoadAchievements")} onRetry={() => achievementsQuery.refetch()} />
        ) : (
        <>
          {/* Unclaimed achievements ready to claim */}
          {unclaimedAchievements.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-secondary font-semibold mb-2 flex items-center gap-1.5">
                <Gift size={12} /> {t("profile.readyToClaim", { count: unclaimedAchievements.length })}
              </p>
              <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                {unclaimedAchievements.map(ach => (
                  <div key={ach.id} className="card-neon rounded-xl p-3 min-w-[120px] text-center flex-shrink-0 border border-secondary/30">
                    <span className="text-2xl block mb-1">{ach.icon}</span>
                    <p className="text-[11px] font-semibold mb-1">{t(`achievements.names.${ach.name}`, { defaultValue: ach.name })}</p>
                    <button
                      onClick={() => handleClaim(ach.id)}
                      disabled={claimMutation.isPending}
                      className="w-full py-1 rounded-lg bg-secondary/20 text-secondary text-[10px] font-bold hover:bg-secondary/30 transition-colors"
                    >
                      {claimingId === ach.id ? "✨ Claimed!" : `+${user?.isPremium ? ach.points * 2 : ach.points} XP${user?.isPremium ? " (2x)" : ""}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Already claimed achievements */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
            {earnedAchievements.filter((a: any) => a.claimedAt).slice(0, 5).map(ach => (
              <div key={ach.id} className="card-neon rounded-xl p-3 min-w-[110px] text-center flex-shrink-0 trophy-shine">
                <span className="text-2xl block mb-1.5">{ach.icon}</span>
                <p className="text-[11px] font-semibold">{t(`achievements.names.${ach.name}`, { defaultValue: ach.name })}</p>
                <p className="text-[9px] text-secondary font-bold">+{user?.isPremium ? ach.points * 2 : ach.points} XP{user?.isPremium ? " (2x)" : ""}</p>
              </div>
            ))}
          </div>
        </>
        )}
      </div>

      <div className="section-divider mx-5" />

      {/* Menu Links */}
      <div className="px-5 mb-4 space-y-1.5">
        <MenuLink icon={Edit} label={t("profile.editProfile")} onClick={() => navigate("editProfile")} />
        <MenuLink icon={Lock} label={t("profile.privacySettings")} onClick={() => navigate("settings")} />
        <MenuLink icon={Trophy} label={t("profile.gameHistory")} onClick={() => navigate("gameHistory")} />
        <MenuLink icon={MapPin} label={t("profile.findCourts")} onClick={() => navigate("courts")} />
        <MenuLink icon={Users} label={t("profile.groups")} onClick={() => navigate("groups")} />
        <MenuLink icon={GraduationCap} label={t("profile.coaching")} onClick={() => navigate("coaching")} />
        <MenuLink icon={Clock} label={t("profile.pendingRequests")} onClick={() => navigate("pending")} />
        <MenuLink icon={Crown} label={t("profile.leaderboard")} onClick={() => navigate("leaderboard")} />
        {(user?.role === "admin" || user?.role === "superadmin") && (
          <MenuLink icon={Shield} label={t("profile.adminDashboard")} onClick={() => navigate("admin")} accent />
        )}
        {user?.role === "superadmin" && (
          <MenuLink icon={Shield} label={t("profile.superAdmin")} onClick={() => navigate("superadmin")} accent />
        )}
        {!user.isPremium && (
          <MenuLink icon={Crown} label={t("profile.upgradeToPremium")} onClick={() => navigate("premium")} accent />
        )}
        <MenuLink icon={HelpCircle} label={t("profile.helpSupport")} onClick={() => navigate("help")} />
        <MenuLink icon={LogOut} label={t("profile.logOut")} onClick={logout} destructive />
      </div>
    </div>
  );
}

function MenuLink({
  icon: Icon,
  label,
  onClick,
  accent,
  destructive,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  accent?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full card-elevated rounded-xl p-3.5 flex items-center gap-3 text-left transition-all hover:scale-[1.01] active:scale-[0.98] ${
        destructive ? "border-red-500/10" : ""
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        destructive ? "bg-red-500/10" : accent ? "bg-secondary/10" : "bg-muted/15"
      }`}>
        <Icon
          size={16}
          className={
            destructive ? "text-red-400" : accent ? "text-secondary" : "text-muted-foreground"
          }
        />
      </div>
      <span className={`flex-1 text-sm font-medium ${destructive ? "text-red-400" : accent ? "text-secondary" : ""}`}>
        {label}
      </span>
      <ChevronRight size={14} className="text-muted-foreground/40" />
    </button>
  );
}
