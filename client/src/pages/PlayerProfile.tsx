import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName, getSkillLevelColor, getVibeColor } from "@/lib/avatarUtils";
import { getLevelInfo, getTierColor } from "@/lib/gamification";
import { ArrowLeft, Crown, MapPin, MessageCircle, Star, Shield, CheckCircle, Flag, ThumbsUp, Loader2, Ban, Swords, Flame, Send, X, Calendar, Clock, Users, AlertCircle, RefreshCw, Trophy, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
const CourtPickerModal = lazy(() => import("@/components/CourtPickerModal"));

const endorsementTypes = ["good-sport", "skilled-player", "great-partner", "on-time", "accurate-rater"] as const;

const endorsementLabels: Record<string, string> = {
  "good-sport": "Good Sport",
  "skilled-player": "Skilled Player",
  "great-partner": "Great Partner",
  "on-time": "On-Time",
  "accurate-rater": "Strategic Mind",
};

const endorsementEmojis: Record<string, string> = {
  "good-sport": "🤝",
  "skilled-player": "🏆",
  "great-partner": "⭐",
  "on-time": "⏰",
  "accurate-rater": "🧠",
};

export default function PlayerProfile() {
  const { selectedPlayerId, navigate, goBack, setActiveTab, user, selectMatch } = useApp();
  const { t, i18n } = useTranslation();
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const profileQuery = trpc.users.getProfile.useQuery(
    { userId: selectedPlayerId! },
    { enabled: !!selectedPlayerId }
  );
  const endorsementsQuery = trpc.users.getEndorsements.useQuery(
    { userId: selectedPlayerId! },
    { enabled: !!selectedPlayerId }
  );
  const endorsements = endorsementsQuery.data ?? [];
  const achievementsQuery = trpc.achievements.forUser.useQuery(
    { userId: selectedPlayerId! },
    { enabled: !!selectedPlayerId }
  );
  const playerAchievements = (achievementsQuery.data ?? []).filter((a: any) => a.claimed);
  const myEndorsementsQuery = trpc.endorsements.getMyEndorsements.useQuery(
    { userId: selectedPlayerId! },
    { enabled: !!selectedPlayerId }
  );
  const [endorsedTypes, setEndorsedTypes] = useState<string[]>([]);
  // Sync endorsed types from server data
  useEffect(() => {
    if (myEndorsementsQuery.data) {
      setEndorsedTypes(myEndorsementsQuery.data.map((e: any) => e.type));
    }
  }, [myEndorsementsQuery.data]);
  const endorseMutation = trpc.endorsements.give.useMutation({
    onSuccess: () => { endorsementsQuery.refetch(); myEndorsementsQuery.refetch(); toast.success(t("playerProfile.endorsementXp")); },
    onError: (err) => { setEndorsedTypes(myEndorsementsQuery.data?.map((e: any) => e.type) ?? []); myEndorsementsQuery.refetch(); toast.error(err.message); },
  });
  const reportMutation = trpc.moderation.report.useMutation({
    onSuccess: () => { setReportSubmitted(true); setShowReport(false); toast.success(t("playerProfile.reportSubmitted")); },
    onError: (err) => toast.error(err.message),
  });
  const blockMutation = trpc.moderation.block.useMutation({
    onSuccess: () => { toast.success(t("playerProfile.userBlocked")); goBack(); },
    onError: (err) => toast.error(err.message),
  });
  const favoriteQuery = trpc.favorites.check.useQuery(
    { favoriteId: selectedPlayerId! },
    { enabled: !!selectedPlayerId }
  );
  const favoriteMutation = trpc.favorites.add.useMutation({
    onSuccess: () => { favoriteQuery.refetch(); toast.success(t("profile.addedToFavorites")); },
    onError: (err) => toast.error(err.message),
  });
  const unfavoriteMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => { favoriteQuery.refetch(); toast.success(t("profile.removedFromFavorites")); },
    onError: (err) => toast.error(err.message),
  });
  const rivalriesQuery = trpc.rivalries.list.useQuery();
  const rivalryData = (rivalriesQuery.data ?? []).find((r: any) => r.opponentId === selectedPlayerId);
  const [challengeSent, setChallengeSent] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [challengeGameType, setChallengeGameType] = useState<"casual" | "competitive" | "tournament" | "practice">("casual");
  const [challengeFormat, setChallengeFormat] = useState<"singles" | "mens-doubles" | "womens-doubles" | "mixed-doubles">("singles");
  const [challengeMessage, setChallengeMessage] = useState("");
  const [challengeDate, setChallengeDate] = useState("");
  const [challengeDuration, setChallengeDuration] = useState(60);
  const [challengeLocation, setChallengeLocation] = useState("");
  const [challengeNotes, setChallengeNotes] = useState("");
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const challengeMutation = trpc.challenges.send.useMutation({
    onSuccess: () => {
      setChallengeSent(true);
      setShowChallengeDialog(false);
      toast.success(t("playerProfile.challengeSentToast"));
    },
    onError: (err) => toast.error(err.message),
  });

  const startDmMutation = trpc.chat.startDirectMessage.useMutation({
    onSuccess: (data) => {
      selectMatch(null, data.conversationId);
    },
    onError: (err) => toast.error(err.message),
  });

  // Check if already matched with this player (to bypass premium gate)
  const matchesQuery = trpc.matches.list.useQuery();
  const existingMatch = (matchesQuery.data ?? []).find((m: any) => m.user?.id === selectedPlayerId);

  if (!selectedPlayerId || (!profileQuery.data && !profileQuery.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("playerProfile.noPlayerSelected")}</p>
      </div>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
        <AlertCircle size={32} className="text-destructive/60" />
        <p className="text-sm font-medium text-muted-foreground">{t("common.loadError")}</p>
        <button
          onClick={() => profileQuery.refetch()}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <RefreshCw size={12} /> {t("common.retry")}
        </button>
      </div>
    );
  }

  const player: any = profileQuery.data;
  const levelInfo = getLevelInfo(player?.xp ?? 0);

  return (
    <div className="pb-24 min-h-screen">
      {/* Premium Header */}
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-primary/8 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("playerProfile.title")}</h1>
        </div>
      </div>

      {/* Profile Header */}
      <div className="px-5 py-6 text-center relative">
        <div className="absolute w-[300px] h-[300px] rounded-full bg-primary/20 blur-[80px] -top-20 left-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <PlayerAvatar user={player} size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold">{getDisplayName(player)}</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">{player.age}</span>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin size={12} /> {t("playerProfile.nearby")}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            {player.isPremium && (
              <span className="flex items-center gap-1 text-xs text-secondary"><Crown size={12} /> {t("playerProfile.premium")}</span>
            )}
            {player.isPhotoVerified && (
              <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> {t("playerProfile.verified")}</span>
            )}
            {player.isRatingVerified && (
              <span className="flex items-center gap-1 text-xs text-secondary"><Shield size={12} /> {t("playerProfile.rated")}</span>
            )}
          </div>
          <div className="flex items-center justify-center gap-1 mt-2">
            <span className="text-xs font-bold" style={{ color: getTierColor(levelInfo.tier) }}>
              {t("playerProfile.level", { level: levelInfo.level })}
            </span>
            <span className="text-xs text-muted-foreground">{levelInfo.title}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-4 gap-2">
          <div className="card-elevated rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{player.totalGames}</p>
            <p className="text-[10px] text-muted-foreground">{t("playerProfile.games")}</p>
          </div>
          <div className="card-elevated rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{player.totalWins ?? 0}<span className="text-xs text-muted-foreground font-normal">/{player.totalLosses ?? 0}</span></p>
            <p className="text-[10px] text-muted-foreground">{t("playerProfile.winLoss")}</p>
          </div>
          <div className="card-elevated rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Star size={12} className="text-secondary fill-secondary" />
              <span className="text-lg font-bold">{player.averageRating}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t("playerProfile.rating")}</p>
          </div>
          <div className="card-elevated rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Flame size={12} className="text-secondary" />
              <span className="text-lg font-bold">{player.currentStreak ?? 0}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t("playerProfile.streak")}</p>
          </div>
        </div>
      </div>

      {/* Favorite & Rivalry */}
      <div className="px-5 mb-4 space-y-2">
        <button
          onClick={() => favoriteQuery.data
            ? unfavoriteMutation.mutate({ favoriteId: selectedPlayerId! })
            : favoriteMutation.mutate({ favoriteId: selectedPlayerId! })
          }
          disabled={favoriteMutation.isPending || unfavoriteMutation.isPending}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
            favoriteQuery.data
              ? "bg-pink-500/15 border border-pink-500/30 text-pink-400"
              : "card-elevated hover:bg-muted/50"
          )}
        >
          <Heart size={16} className={favoriteQuery.data ? "fill-current" : ""} />
          {favoriteQuery.data ? t("profile.favorited") : t("profile.addToFavorites")}
        </button>

        {rivalryData && (
          <div className="card-elevated rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Swords size={14} className="text-[#BFFF00]" />
              <span className="text-xs font-bold">{t("profile.rivalry")}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-green-400">{rivalryData.myWins}</p>
                <p className="text-[10px] text-muted-foreground">{t("profile.yourWins")}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-muted-foreground">{rivalryData.totalGames}</p>
                <p className="text-[10px] text-muted-foreground">{t("profile.games")}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-400">{rivalryData.theirWins}</p>
                <p className="text-[10px] text-muted-foreground">{t("profile.theirWins")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="px-5 mb-4">
        <div className="card-elevated rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${getSkillLevelColor(player.skillLevel)}22`, color: getSkillLevelColor(player.skillLevel) }}>
              {player.skillLevel}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${getVibeColor(player.vibe)}22`, color: getVibeColor(player.vibe) }}>
              {player.vibe}
            </span>
            <span className="text-xs text-muted-foreground">✋ {player.handedness}</span>
            <span className="text-xs text-muted-foreground">{player.pace}</span>
          </div>
          <p className="text-sm text-muted-foreground">{player.bio}</p>
          {player.playStyle && (
            <div className="flex flex-wrap gap-1.5">
              {String(player.playStyle).split(",").map(s => s.trim()).filter(Boolean).map((s: string) => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-accent/30 text-accent">{s}</span>
              ))}
            </div>
          )}
          {player.goals && (
            <div className="flex flex-wrap gap-1.5">
              {String(player.goals).split(",").map(g => g.trim()).filter(Boolean).map((g: string) => (
                <span key={g} className="text-[10px] px-2 py-0.5 rounded-full border border-secondary/30 text-secondary">{g}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Endorsements */}
      {endorsements.length > 0 && (
        <div className="px-5 mb-4">
          <h2 className="font-semibold mb-2">{t("playerProfile.endorsements")}</h2>
          <div className="card-elevated rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3">
              {endorsements.map((e: any) => (
                <div key={e.type} className="flex items-center gap-2">
                  <Star size={14} className="text-secondary fill-secondary" />
                  <div>
                    <p className="text-sm font-medium">{{"good-sport": t("playerProfile.goodSport"), "skilled-player": t("playerProfile.skilledPlayer"), "great-partner": t("playerProfile.greatPartner"), "on-time": t("playerProfile.onTime"), "accurate-rater": t("playerProfile.strategicMind")}[e.type as string] ?? e.type}</p>
                    <p className="text-xs text-muted-foreground">{t("playerProfile.endorsementsCount", { count: e.count })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trophy Case */}
      {playerAchievements.length > 0 && (
        <div className="px-5 mb-4">
          <h2 className="font-semibold mb-2 flex items-center gap-1.5">
            <Trophy size={14} className="text-secondary" />
            {t("playerProfile.trophyCase")}
          </h2>
          <div className="card-elevated rounded-xl p-4">
            <div className="flex flex-wrap gap-2">
              {playerAchievements.slice(0, 8).map((a: any) => (
                <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/10 border border-secondary/20">
                  <span className="text-sm">{a.icon}</span>
                  <span className="text-[10px] font-medium text-secondary">{a.name}</span>
                </div>
              ))}
              {playerAchievements.length > 8 && (
                <span className="text-[10px] text-muted-foreground self-center px-2">{t("profile.moreAchievements", { count: playerAchievements.length - 8 })}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Availability */}
      {(player.availability ?? []).length > 0 && (
      <div className="px-5 mb-4">
        <h2 className="font-semibold mb-2">{t("playerProfile.availability")}</h2>
        <div className="card-elevated rounded-xl p-4">
          <div className="flex flex-wrap gap-1.5">
            {(player.availability ?? []).map((a: string) => (
              <span key={a} className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground">{a}</span>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Actions */}
      <div className="px-5 mb-4 space-y-2">
        <div className="flex gap-2">
          <Button onClick={() => {
            if (existingMatch?.conversationId) {
              selectMatch(existingMatch.id, existingMatch.conversationId);
            } else if (user?.isPremium) {
              startDmMutation.mutate({ targetUserId: selectedPlayerId! });
            } else {
              navigate("swipe");
              toast(t("playerProfile.swipeToMatch"));
            }
          }} disabled={startDmMutation.isPending} className="flex-1 bg-primary text-white gap-2 h-11">
            <MessageCircle size={16} /> {existingMatch ? t("playerProfile.directMessage") : user?.isPremium ? t("playerProfile.directMessage") : t("playerProfile.message")}
          </Button>
          <Button
            onClick={() => setShowChallengeDialog(true)}
            disabled={challengeSent || challengeMutation.isPending}
            className="flex-1 bg-gradient-to-r from-secondary to-secondary/80 text-background gap-2 h-11"
          >
            <Swords size={16} /> {challengeSent ? t("playerProfile.challengeSent") : t("playerProfile.challenge")}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBlockConfirm(true)}
            className="flex-1 gap-2 h-9 border-primary/30 text-primary hover:bg-primary/10 text-xs"
          >
            <Ban size={14} /> {t("playerProfile.block")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowReport(!showReport)}
            className={cn("flex-1 gap-2 h-9 text-xs", showReport ? "border-red-500 text-red-400" : "border-red-500/30 text-red-400 hover:bg-red-500/10")}
          >
            <Flag size={14} /> {t("playerProfile.report")}
          </Button>
        </div>
      </div>

      {/* Block Confirmation */}
      {showBlockConfirm && (
        <div className="px-5 mb-4">
          <div className="card-elevated rounded-xl p-4 border-primary/30">
            <h3 className="text-sm font-semibold mb-2">{t("playerProfile.blockConfirm", { name: getDisplayName(player) })}</h3>
            <p className="text-xs text-muted-foreground mb-3">{t("playerProfile.blockDesc")}</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-primary text-white" onClick={() => { blockMutation.mutate({ blockedId: player.id }); setShowBlockConfirm(false); }}>
                {t("playerProfile.confirmBlock")}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowBlockConfirm(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Report Form */}
      {showReport && !reportSubmitted && (
        <div className="px-5 mb-4">
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">{t("playerProfile.reportPlayer")}</h3>
            <div className="space-y-2 mb-3">
              {[{label: t("playerProfile.reportReasonInappropriate"), value: "Inappropriate behavior"}, {label: t("playerProfile.reportReasonFake"), value: "Fake profile"}, {label: t("playerProfile.reportReasonHarassment"), value: "Harassment"}, {label: t("playerProfile.reportReasonSpam"), value: "Spam"}, {label: t("playerProfile.reportReasonOther"), value: "Other"}].map(reason => (
                <button
                  key={reason.value}
                  onClick={() => setReportReason(reason.value)}
                  className={cn("w-full text-left px-3 py-2 rounded-xl text-xs border transition-all",
                    reportReason === reason.value ? "border-red-500 bg-red-500/10 text-red-400" : "border-border text-muted-foreground"
                  )}
                >
                  {reason.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              disabled={!reportReason}
              onClick={() => {
                const reportTypeMap: Record<string, "inappropriate" | "fake-profile" | "harassment" | "safety" | "other"> = {
                  "Inappropriate behavior": "inappropriate",
                  "Fake profile": "fake-profile",
                  "Harassment": "harassment",
                  "Spam": "safety",
                  "Other": "other",
                };
                reportMutation.mutate({
                  reportedId: player.id,
                  reportType: reportTypeMap[reportReason] ?? "other",
                  description: reportReason,
                });
              }}
              className="w-full bg-red-500 text-white"
            >
              {t("playerProfile.submitReport")}
            </Button>
          </div>
        </div>
      )}
      {reportSubmitted && (
        <div className="px-5 mb-4">
          <div className="card-elevated rounded-xl p-4 border-green-500/30 text-center">
            <CheckCircle size={24} className="mx-auto text-green-400 mb-2" />
            <p className="text-sm font-medium text-green-400">{t("playerProfile.reportSubmitted")}</p>
            <p className="text-[10px] text-muted-foreground">{t("playerProfile.reportReviewTime")}</p>
          </div>
        </div>
      )}

      {/* Endorse Player */}
      <div className="px-5 mb-4">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <ThumbsUp size={14} className="text-secondary" /> {t("playerProfile.endorsements")}
        </h2>
        <div className="card-elevated rounded-xl p-4">
          <div className="flex flex-wrap gap-2">
            {endorsementTypes.map(type => {
              const alreadyEndorsed = endorsedTypes.includes(type);
              return (
                <button
                  key={type}
                  disabled={alreadyEndorsed}
                  onClick={() => {
                    if (!alreadyEndorsed) {
                      endorseMutation.mutate({ userId: player.id, type });
                      setEndorsedTypes([...endorsedTypes, type]);
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5",
                    alreadyEndorsed
                      ? "border-green-500/30 bg-green-500/10 text-green-400"
                      : "border-secondary/30 text-secondary hover:bg-secondary/10"
                  )}
                >
                  <span>{endorsementEmojis[type]}</span>
                  {{"good-sport": t("playerProfile.goodSport"), "skilled-player": t("playerProfile.skilledPlayer"), "great-partner": t("playerProfile.greatPartner"), "on-time": t("playerProfile.onTime"), "accurate-rater": t("playerProfile.strategicMind")}[type] ?? type}
                  {alreadyEndorsed && <CheckCircle size={10} />}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">{t("playerProfile.endorsementXp")}</p>
        </div>
      </div>

      {/* Challenge Dialog */}
      {showChallengeDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-0 sm:items-center sm:p-6" onClick={() => setShowChallengeDialog(false)}>
          <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm space-y-3 animate-slide-up max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Swords size={16} className="text-secondary" /> {t("playerProfile.challengeTitle", { name: getDisplayName(player) })}
              </h3>
              <button onClick={() => setShowChallengeDialog(false)} className="p-1 rounded-lg hover:bg-muted/20"><X size={16} /></button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("playerProfile.gameType")}</label>
              <div className="flex gap-1.5 flex-wrap">
                {(["casual", "competitive", "tournament", "practice"] as ("casual" | "competitive" | "tournament" | "practice")[]).map(gt => (
                  <button key={gt} onClick={() => setChallengeGameType(gt)}
                    className={cn("text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all",
                      challengeGameType === gt ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground hover:bg-muted/25"
                    )}>{t(`gameTypes.${gt}`)}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("playerProfile.format")}</label>
              <div className="flex gap-1.5 flex-wrap">
                {([{ v: "singles", l: "singles" }, { v: "mens-doubles", l: "mens-doubles" }, { v: "womens-doubles", l: "womens-doubles" }, { v: "mixed-doubles", l: "mixed-doubles" }] as { v: "singles" | "mens-doubles" | "womens-doubles" | "mixed-doubles"; l: string }[]).map(f => (
                  <button key={f.v} onClick={() => setChallengeFormat(f.v)}
                    className={cn("text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all",
                      challengeFormat === f.v ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground hover:bg-muted/25"
                    )}>{t(`gameFormats.${f.l}`)}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                <Calendar size={11} className="inline mr-1" />{t("playerProfile.date")} & {t("playerProfile.time")}
              </label>
              {/* Quick date buttons */}
              <div className="flex gap-1.5 mb-2">
                {(() => {
                  const today = new Date();
                  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
                  const nextSat = new Date(today); nextSat.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7));
                  const nextSun = new Date(today); nextSun.setDate(nextSat.getDate() + 1);
                  const fmt = (d: Date) => d.toISOString().split("T")[0];
                  const currentDate = challengeDate?.split("T")[0] ?? "";
                  const quickDates = [
                    { label: t("playerProfile.today", "Today"), value: fmt(today) },
                    { label: t("playerProfile.tomorrow", "Tomorrow"), value: fmt(tomorrow) },
                    { label: t("playerProfile.saturday", "Sat"), value: fmt(nextSat) },
                    { label: t("playerProfile.sunday", "Sun"), value: fmt(nextSun) },
                  ];
                  return quickDates.map(qd => (
                    <button key={qd.value} onClick={() => {
                      const time = challengeDate?.includes("T") ? challengeDate.split("T")[1] : "18:00";
                      setChallengeDate(`${qd.value}T${time}`);
                    }}
                      className={cn("text-[10px] px-2.5 py-1.5 rounded-lg font-medium transition-all flex-1",
                        currentDate === qd.value ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground hover:bg-muted/25"
                      )}
                    >{qd.label}</button>
                  ));
                })()}
              </div>
              {/* Quick time slot buttons */}
              <div className="flex gap-1.5 mb-2">
                {[
                  { label: t("playerProfile.morning", "Morning"), time: "09:00" },
                  { label: t("playerProfile.afternoon", "Afternoon"), time: "14:00" },
                  { label: t("playerProfile.evening", "Evening"), time: "18:00" },
                  { label: t("playerProfile.night", "Night"), time: "20:00" },
                ].map(slot => {
                  const currentTime = challengeDate?.includes("T") ? challengeDate.split("T")[1]?.slice(0, 5) : "";
                  return (
                    <button key={slot.time} onClick={() => {
                      const date = challengeDate?.split("T")[0] || new Date().toISOString().split("T")[0];
                      setChallengeDate(`${date}T${slot.time}`);
                    }}
                      className={cn("text-[10px] px-2.5 py-1.5 rounded-lg font-medium transition-all flex-1",
                        currentTime === slot.time ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground hover:bg-muted/25"
                      )}
                    >{slot.label}</button>
                  );
                })}
              </div>
              {/* Fallback custom input */}
              <input type="datetime-local" value={challengeDate} onChange={e => setChallengeDate(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                <Clock size={11} className="inline mr-1" />{t("playerProfile.durationMins")}
              </label>
              <div className="flex gap-1.5">
                {[30, 60, 90, 120].map(d => (
                  <button key={d} onClick={() => setChallengeDuration(d)}
                    className={cn("text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all flex-1",
                      challengeDuration === d ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground"
                    )}>{d}m</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                <MapPin size={11} className="inline mr-1" />{t("playerProfile.location")}
              </label>
              <button
                onClick={() => setShowCourtPicker(true)}
                className={cn("w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2",
                  challengeLocation ? "border-secondary/40 bg-secondary/5" : "border-border bg-background/50"
                )}
              >
                <MapPin size={14} className={challengeLocation ? "text-secondary" : "text-muted-foreground"} />
                <span className={cn("text-sm", challengeLocation ? "text-foreground" : "text-muted-foreground")}>
                  {challengeLocation || t("playerProfile.courtPlaceholder")}
                </span>
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("playerProfile.messageOptional")}</label>
              <Input value={challengeMessage} onChange={e => setChallengeMessage(e.target.value.slice(0, 200))}
                placeholder={t("playerProfile.challengeMessagePlaceholder")} className="bg-background/50" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("playerProfile.notes")}</label>
              <textarea value={challengeNotes} onChange={e => setChallengeNotes(e.target.value.slice(0, 500))}
                placeholder={t("playerProfile.notesPlaceholder")} rows={2}
                className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <Button
              onClick={() => challengeMutation.mutate({
                challengedId: player.id,
                gameType: challengeGameType,
                format: challengeFormat,
                message: challengeMessage || undefined,
                scheduledAt: challengeDate || undefined,
                durationMinutes: challengeDuration,
                locationName: challengeLocation || undefined,
                notes: challengeNotes || undefined,
              })}
              disabled={challengeMutation.isPending}
              className="w-full bg-gradient-to-r from-secondary to-secondary/80 text-background font-bold gap-2"
            >
              <Swords size={16} /> {challengeMutation.isPending ? t("playerProfile.sendChallenge") + "..." : t("playerProfile.sendChallenge")}
            </Button>
          </div>
        </div>
      )}

      {showCourtPicker && (
        <Suspense fallback={null}>
          <CourtPickerModal
            open={showCourtPicker}
            onClose={() => setShowCourtPicker(false)}
            onSelect={(court) => setChallengeLocation(court.name + (court.address ? ` — ${court.address}` : ""))}
            title={t("playerProfile.selectCourtForChallenge")}
          />
        </Suspense>
      )}
    </div>
  );
}
