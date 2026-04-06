import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Crown, Zap, Eye, Star, Shield, Sparkles, Check, X, Rocket, Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName } from "@/lib/avatarUtils";

const features = [
  { icon: <Zap size={20} />, titleKey: "featureUnlimitedSwipes", descKey: "featureUnlimitedSwipesDesc", free: false },
  { icon: <Eye size={20} />, titleKey: "featureSeeWhoLiked", descKey: "featureSeeWhoLikedDesc", free: false },
  { icon: <MessageCircle size={20} />, titleKey: "featureDirectMessage", descKey: "featureDirectMessageDesc", free: false },
  { icon: <Star size={20} />, titleKey: "featureAdvancedFilters", descKey: "featureAdvancedFiltersDesc", free: false },
  { icon: <Sparkles size={20} />, titleKey: "featureProfileBoost", descKey: "featureProfileBoostDesc", free: false },
  { icon: <Shield size={20} />, titleKey: "featureReadReceipts", descKey: "featureReadReceiptsDesc", free: false },
  { icon: <Crown size={20} />, titleKey: "featurePriorityMatching", descKey: "featurePriorityMatchingDesc", free: false },
];

const plans = [
  { id: "monthly", nameKey: "planMonthly", priceKey: "planMonthlyPrice", periodKey: "planMonthlyPeriod", savingsKey: null as string | null },
  { id: "yearly", nameKey: "planAnnual", priceKey: "planAnnualPrice", periodKey: "planAnnualPeriod", savingsKey: "save33" },
];

export default function PremiumScreen() {
  const { t, i18n } = useTranslation();
  const { user, navigate, goBack, selectPlayer } = useApp();
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [activeSection, setActiveSection] = useState<"features" | "liked" | "boost">("features");
  const checkoutMutation = trpc.premium.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.success(t("premium.redirecting"));
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const whoLikedQuery = trpc.swipes.whoLikedYou.useQuery(undefined, { enabled: !!user?.isPremium });
  const boostMutation = trpc.swipes.boost.useMutation({
    onSuccess: () => toast.success(t("premium.profileBoosted")),
    onError: (err) => toast.error(err.message),
  });

  if (user?.isPremium) {
    const whoLiked: any[] = whoLikedQuery.data ?? [];
    return (
      <div className="pb-24 min-h-screen">
        <div className="px-4 pt-6 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} className="p-1 rounded-full hover:bg-muted/20">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">{t("premium.title")}</h1>
        </div>
        <div className="px-4 pt-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center mx-auto mb-3"
          >
            <Crown size={28} className="text-background" />
          </motion.div>
          <h2 className="text-xl font-bold mb-1">{t("premium.youArePremium")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("premium.allFeaturesUnlocked")}</p>
        </div>

        {/* Section Tabs */}
        <div className="px-4 mb-4 flex gap-1.5">
          {([
            { key: "features", label: t("premium.features"), icon: Crown },
            { key: "liked", label: t("premium.whoLikedYou"), icon: Heart },
            { key: "boost", label: t("premium.profileBoost"), icon: Rocket },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveSection(tab.key)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-1 justify-center",
                activeSection === tab.key ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}>
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Features List */}
        {activeSection === "features" && (
          <div className="px-4">
            <div className="card-elevated rounded-xl p-4 text-left space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="text-secondary">{f.icon}</div>
                  <div>
                    <p className="text-sm font-medium">{t(`premium.${f.titleKey}`)}</p>
                    <p className="text-[10px] text-muted-foreground">{t(`premium.${f.descKey}`)}</p>
                  </div>
                  <Check size={14} className="ml-auto text-green-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Who Liked You */}
        {activeSection === "liked" && (
          <div className="px-4 space-y-3">
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Heart size={14} className="text-red-400" /> {t("premium.playersWhoRallied")}
              </h3>
              {whoLikedQuery.isLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("premium.loading")}</p>
              ) : whoLiked.length === 0 ? (
                <div className="text-center py-6">
                  <Eye size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t("premium.noOneRallied")}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{t("premium.keepSwiping")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {whoLiked.map((p: any) => (
                    <button key={p.id} onClick={() => selectPlayer(p.id)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/10 transition-colors text-left">
                      <PlayerAvatar user={p} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getDisplayName(p)}</p>
                        <p className="text-[10px] text-muted-foreground">{p.skillLevel} · {p.vibe}</p>
                      </div>
                      <Heart size={14} className="text-red-400 fill-red-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profile Boost */}
        {activeSection === "boost" && (
          <div className="px-4 space-y-3">
            <div className="card-elevated rounded-xl p-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-orange-500/10 flex items-center justify-center mx-auto mb-3">
                <Rocket size={28} className="text-secondary" />
              </div>
              <h3 className="font-bold text-base mb-1">{t("premium.profileBoostTitle")}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t("premium.profileBoostDesc")}</p>
              <div className="card-elevated rounded-xl p-3 mb-4 text-left">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{t("premium.boostsRemaining")}</span>
                  <span className="font-bold text-secondary">{user.profileBoostsRemaining ?? 0}/5</span>
                </div>
                {user.profileBoostedUntil && new Date(user.profileBoostedUntil) > new Date() && (
                  <p className="text-[10px] text-green-400 font-medium mt-1">
                    🟢 Active until {new Date(user.profileBoostedUntil).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <Button
                onClick={() => boostMutation.mutate()}
                disabled={boostMutation.isPending || (user.profileBoostsRemaining ?? 0) <= 0 || (user.profileBoostedUntil ? new Date(user.profileBoostedUntil) > new Date() : false)}
                className="w-full bg-gradient-to-r from-secondary to-secondary/80 text-background font-bold gap-2"
              >
                <Rocket size={16} /> {boostMutation.isPending ? t("premium.boosting") : t("premium.activateBoost")}
              </Button>
              {(user.profileBoostsRemaining ?? 0) <= 0 && (
                <p className="text-[10px] text-muted-foreground mt-2">{t("premium.boostRefresh")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen">
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => goBack()} className="p-1 rounded-full hover:bg-muted/20">
          <ArrowLeft size={20} />
        </button>
          <h1 className="text-lg font-bold">{t("premium.title")}</h1>
        </div>

      {/* Hero */}
      <div className="px-4 pt-4 text-center mb-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center mx-auto mb-3"
        >
          <Crown size={28} className="text-background" />
        </motion.div>
        <h2 className="text-xl font-bold mb-1">{t("premium.upgradeToPremium")}</h2>
        <p className="text-sm text-muted-foreground">{t("premium.unlockPotential")}</p>
      </div>

      {/* Feature Comparison */}
      <div className="px-4 mb-6">
        <div className="card-elevated rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 gap-0 text-center text-xs font-semibold border-b border-border p-3">
            <span>{t("premium.comparisonFeature")}</span>
            <span className="text-muted-foreground">{t("premium.comparisonFree")}</span>
            <span className="text-secondary">{t("premium.comparisonPremium")}</span>
          </div>
          {[
            { name: t("premium.dailySwipes"), free: t("premium.dailySwipesFree"), premium: t("premium.dailySwipesPremium") },
            { name: t("premium.featureSeeWhoLiked"), free: "—", premium: "✓" },
            { name: t("premium.featureAdvancedFilters"), free: "—", premium: "✓" },
            { name: t("premium.featureProfileBoost"), free: t("premium.boostFree"), premium: t("premium.boostPremium") },
            { name: t("premium.featureReadReceipts"), free: "—", premium: "✓" },
            { name: t("premium.featurePriorityMatching"), free: "—", premium: "✓" },
            { name: t("premium.featureDirectMessage", "Direct Message"), free: "—", premium: "✓" },
            { name: t("premium.featureSuperRally", "Super Rally"), free: "—", premium: t("premium.superRallyLimit", "1/day") },
            { name: t("premium.featureGhostMode", "Ghost Mode"), free: "—", premium: "✓" },
            { name: t("premium.featureTravelMode", "Travel Mode"), free: "—", premium: "✓" },
            { name: t("premium.featureDoubleXp", "2x XP"), free: "1x", premium: "2x" },
            { name: t("premium.featureSecondChances", "Second Chances"), free: "—", premium: "✓" },
          ].map((row, i) => (
            <div key={i} className={cn("grid grid-cols-3 gap-0 text-center text-xs p-3", i % 2 === 0 && "bg-muted/5")}>
              <span className="text-left">{row.name}</span>
              <span className="text-muted-foreground">{row.free}</span>
              <span className="text-secondary font-medium">{row.premium}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="px-4 mb-6 space-y-3">
        {plans.map(plan => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            className={cn(
              "w-full card-elevated rounded-xl p-4 flex items-center justify-between transition-all",
              selectedPlan === plan.id
                ? "border-secondary bg-secondary/10"
                : "border-border"
            )}
          >
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{t(`premium.${plan.nameKey}`)}</p>
                {plan.savingsKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                    {t(`premium.${plan.savingsKey}`)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t(`premium.${plan.priceKey}`)}{t(`premium.${plan.periodKey}`)}</p>
            </div>
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                selectedPlan === plan.id
                  ? "border-secondary bg-secondary"
                  : "border-muted-foreground"
              )}
            >
              {selectedPlan === plan.id && <Check size={10} className="text-background" />}
            </div>
          </button>
        ))}
      </div>

      {/* CTA */}
      <div className="px-4">
        <Button
          onClick={() => {
            checkoutMutation.mutate({ plan: selectedPlan === "yearly" ? "annual" : "monthly" });
          }}
          disabled={checkoutMutation.isPending}
          className="w-full bg-gradient-to-r from-secondary to-secondary/80 text-background font-bold py-6 rounded-2xl text-base"
        >
          <Crown size={18} className="mr-2" /> {checkoutMutation.isPending ? t("premium.processing") : t("premium.upgradeNow")}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          {t("premium.cancelAnytime")}
        </p>
      </div>
    </div>
  );
}
