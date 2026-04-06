import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Trophy, Lock, Star, CheckCircle, Loader2, Target, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getLevelInfo } from "@/lib/gamification";
import { QueryError } from "@/components/QueryError";
import { toast } from "sonner";

const categories = ["All", "Social", "Games", "Profile", "Community"];

export default function AchievementsScreen() {
  const { t, i18n } = useTranslation();
  const { user, navigate, goBack } = useApp();
  const utils = trpc.useUtils();
  const achievementsQuery = trpc.achievements.list.useQuery(undefined, { refetchInterval: 30000 });
  const achievements: any[] = achievementsQuery.data ?? [];
  const [activeCategory, setActiveCategory] = useState("All");

  // Translate achievement name/description using i18n keys (falls back to DB value)
  const achievName = (a: any) => t(`achievements.names.${a.name}`, { defaultValue: a.name });
  const achievDesc = (a: any) => t(`achievements.descriptions.${a.name}`, { defaultValue: a.description });

  // Trigger achievement check on mount (guarded against StrictMode double-fire)
  const checkMutation = trpc.achievements.check.useMutation({
    onSuccess: (data) => {
      if (data.awarded.length > 0) {
        achievementsQuery.refetch();
      }
    },
  });
  const checkedRef = useRef(false);
  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      checkMutation.mutate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const claimMutation = trpc.achievements.claim.useMutation({
    onSuccess: () => {
      achievementsQuery.refetch();
      utils.auth.me.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const [claimedId, setClaimedId] = useState<number | null>(null);

  const handleClaim = (achievementId: number) => {
    setClaimedId(achievementId);
    claimMutation.mutate({ achievementId }, {
      onSettled: () => setTimeout(() => setClaimedId(null), 1200),
    });
  };

  const levelInfo = getLevelInfo(user?.xp ?? 0);

  const filtered = activeCategory === "All"
    ? achievements
    : achievements.filter(a => a.category === activeCategory);

  const earned = filtered.filter(a => a.earnedAt !== null);
  const unclaimed = earned.filter(a => !a.claimedAt).sort((a: any, b: any) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());
  const claimed = earned.filter(a => a.claimedAt).sort((a: any, b: any) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());
  const locked = filtered.filter(a => a.earnedAt === null);

  return (
    <div className="pb-24 min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-secondary/8 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("achievements.title")}</h1>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="px-5 pb-4 animate-slide-up">
        <div className="card-hero rounded-xl p-4">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/25 to-orange-500/15 flex items-center justify-center">
                <Trophy size={24} className="text-secondary" />
              </div>
              <div>
                <p className="text-sm font-bold">{t("achievements.level", { level: levelInfo.level, title: levelInfo.title })}</p>
                <p className="text-xs text-muted-foreground">{t("achievements.xpTotal", { xp: user.xp.toLocaleString() })}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="card-elevated rounded-lg p-2">
                <p className="stat-number text-lg text-secondary">{achievements.filter(a => a.earnedAt !== null).length}</p>
                <p className="text-[10px] text-muted-foreground">{t("achievements.earned")}</p>
              </div>
              <div className="card-elevated rounded-lg p-2">
                <p className="stat-number text-lg text-muted-foreground">{achievements.filter(a => a.earnedAt === null).length}</p>
                <p className="text-[10px] text-muted-foreground">{t("achievements.locked")}</p>
              </div>
              <div className="card-elevated rounded-lg p-2">
                <p className="stat-number text-lg text-accent">
                  {achievements.length > 0 ? Math.round((achievements.filter(a => a.earnedAt !== null).length / achievements.length) * 100) : 0}%
                </p>
                <p className="text-[10px] text-muted-foreground">{t("achievements.complete")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="px-5 pb-4 flex gap-1.5 overflow-x-auto scrollbar-none animate-slide-up delay-100">
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)}
            className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
              activeCategory === c ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
            )}
          >{t(`achievements.category${c}`)}</button>
        ))}
      </div>

      {/* Unclaimed — ready to claim */}
      {achievementsQuery.isError && !achievements.length ? (
        <div className="px-5"><QueryError message={t("achievements.failedLoad")} onRetry={() => achievementsQuery.refetch()} /></div>
      ) : unclaimed.length > 0 ? (
        <div className="px-5 mb-4 animate-slide-up delay-200">
          <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-secondary/25 to-orange-500/15 flex items-center justify-center">
              <Gift size={11} className="text-secondary" />
            </div>
            {t("achievements.readyToClaim", { count: unclaimed.length })}
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {unclaimed.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="card-elevated rounded-xl p-3 text-center relative overflow-hidden border border-secondary/15"
              >
                <AnimatePresence>
                  {claimedId === a.id && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      className="absolute inset-0 z-10 flex items-center justify-center bg-secondary/20 backdrop-blur-sm rounded-xl"
                    >
                      <span className="text-lg font-bold text-secondary">+{user?.isPremium ? a.points * 2 : a.points} XP!</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="text-3xl mb-1">{a.icon}</div>
                <p className="text-[10px] font-bold leading-tight">{achievName(a)}</p>
                <button
                  onClick={() => handleClaim(a.id)}
                  disabled={claimMutation.isPending}
                  className="mt-1.5 w-full py-1 rounded-lg bg-secondary/20 text-secondary text-[10px] font-bold hover:bg-secondary/30 active:scale-95 transition-all"
                >
                  {claimMutation.isPending && claimedId === a.id ? "..." : t("achievements.claimXp", { xp: user?.isPremium ? a.points * 2 : a.points })}
                  {user?.isPremium && <span className="ml-0.5 text-[8px] text-yellow-400">2x</span>}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Claimed / Earned */}
      {claimed.length > 0 ? (
        <div className="px-5 mb-4 animate-slide-up delay-200">
          <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
              <CheckCircle size={11} className="text-secondary" />
            </div>
            {t("achievements.earnedSection", { count: claimed.length })}
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {claimed.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="card-elevated rounded-xl p-3 text-center relative overflow-hidden border border-secondary/10"
              >
                <div className="absolute top-1.5 right-1.5">
                  <CheckCircle size={12} className="text-secondary" />
                </div>
                <div className="text-3xl mb-1">{a.icon}</div>
                <p className="text-[10px] font-bold leading-tight">{achievName(a)}</p>
                <span className="text-[9px] text-secondary font-semibold mt-1 inline-block">+{user?.isPremium ? a.points * 2 : a.points} XP{user?.isPremium ? " (2x)" : ""}</span>
                {a.claimedAt && (
                  <p className="text-[8px] text-muted-foreground mt-0.5">
                    {new Date(a.claimedAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Locked */}
      {locked.length > 0 && (
        <div className="px-5 mb-4 animate-slide-up delay-300">
          <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-muted/30 to-muted/15 flex items-center justify-center">
              <Lock size={11} className="text-muted-foreground" />
            </div>
            {t("achievements.lockedSection", { count: locked.length })}
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {locked.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="card-elevated rounded-xl p-3 text-center opacity-50 grayscale"
              >
                <div className="text-3xl mb-1 relative">
                  {a.icon}
                  <Lock size={10} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <p className="text-[10px] font-bold leading-tight">{achievName(a)}</p>
                <p className="text-[8px] text-muted-foreground mt-0.5">{achievDesc(a)}</p>
                {a.maxProgress > 0 && (
                  <div className="mt-1.5">
                    <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${(a.progress / a.maxProgress) * 100}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-muted-foreground mt-0.5">{a.progress}/{a.maxProgress}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
