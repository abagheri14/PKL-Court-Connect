import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getDisplayName } from "@/lib/avatarUtils";
import { getInitials, getAvatarColor, getSilhouetteColor } from "@/lib/avatarUtils";
import PlayerAvatar from "@/components/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PKLBallIcon } from "@/components/PKLBallLogo";
import {
  Crown, Heart, MapPin, Loader2, ThumbsUp,
  Star, X, Sparkles, Trophy, Flame, Target, CheckCircle, RotateCcw, SlidersHorizontal,
} from "lucide-react";
import { QueryError } from "@/components/QueryError";
import MatchCelebration from "@/components/MatchCelebration";

export default function SwipeDeck() {
  const { user, navigate } = useApp();
  const { t } = useTranslation();
  const { lat, lng, loading: geoLoading, error: geoError } = useGeolocation({ fallbackLat: user?.latitude, fallbackLng: user?.longitude });

  const [matchData, setMatchData] = useState<{ player: any } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterRadius, setFilterRadius] = useState(25);
  const [filterVibe, setFilterVibe] = useState("");
  const [filterSkill, setFilterSkill] = useState("");
  const [filterAgeMin, setFilterAgeMin] = useState(18);
  const [filterAgeMax, setFilterAgeMax] = useState(99);

  const candidatesQuery = trpc.swipes.candidates.useQuery({
    lat, lng, radiusMiles: filterRadius,
    ...(filterVibe ? { vibe: filterVibe } : {}),
    ...(user?.isPremium && filterSkill ? { skillLevel: filterSkill } : {}),
    ...(user?.isPremium && filterAgeMin > 18 ? { ageMin: filterAgeMin } : {}),
    ...(user?.isPremium && filterAgeMax < 99 ? { ageMax: filterAgeMax } : {}),
  }, { enabled: !!(lat && lng), staleTime: 60_000 });
  const remainingQuery = trpc.swipes.remaining.useQuery();
  const unmatchedQuery = trpc.matches.getUnmatched.useQuery(undefined, { enabled: !!user?.isPremium });
  const unmatchedUsers: any[] = unmatchedQuery.data ?? [];
  const rematchMutation = trpc.matches.rematch.useMutation({
    onSuccess: () => { toast.success("Re-matched! Check your matches."); unmatchedQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const swipeMutation = trpc.swipes.create.useMutation({
    onSuccess: (result: any) => {
      if (result?.matched && currentPlayer) {
        setMatchData({ player: currentPlayer });
      }
      setSwipeIndex(i => i + 1);
      setDragX(0);
      setDragY(0);
      setAnimating(false);
      setExitDir(null);
      remainingQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setDragX(0);
      setDragY(0);
      setAnimating(false);
      setExitDir(null);
    },
  });

  const undoMutation = trpc.swipes.undo.useMutation({
    onSuccess: (result: any) => {
      if (result?.undone) {
        setSwipeIndex(i => Math.max(0, i - 1));
        remainingQuery.refetch();
        candidatesQuery.refetch();
        toast.success("Swipe undone!");
      } else {
        toast.info("No recent swipe to undo");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const candidates = candidatesQuery.data ?? [];
  const remaining = remainingQuery.data;
  const swipesRemaining = user?.isPremium ? Infinity : (remaining?.remaining ?? 25);

  const [swipeIndex, setSwipeIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const dragXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const superRallyKey = `pkl_super_rally_${new Date().toISOString().slice(0, 10)}`;
  const [superRallyUsed, setSuperRallyUsed] = useState(() => {
    try { return localStorage.getItem(superRallyKey) === "1"; } catch { return false; }
  });

  const currentPlayer = candidates[swipeIndex];
  const nextPlayer = candidates[swipeIndex + 1];
  const canSwipe = swipesRemaining > 0;
  const outOfCards = swipeIndex >= candidates.length;
  const maxSwipes = user?.maxDailySwipes ?? 25;

  // All handlers and useCallbacks must come before any early returns (Rules of Hooks)
  const SWIPE_THRESHOLD = 60;

  // Use a ref for handleSwipe to avoid stale closure in handlePointerUp
  const handleSwipeRef = useRef<(dir: "left" | "right") => void>(() => {});
  handleSwipeRef.current = (dir: "left" | "right") => {
    if (!currentPlayer || animating || !canSwipe) return;
    setExitDir(dir);
    setAnimating(true);
    swipeMutation.mutate({
      swipedId: currentPlayer.id,
      direction: dir === "right" ? "rally" : "pass",
    });
  };

  const handleSwipe = (dir: "left" | "right") => handleSwipeRef.current(dir);

  const handleSuperRally = () => {
    if (!currentPlayer || animating || !canSwipe) return;
    if (!user?.isPremium) {
      toast(t("swipe.superRallyPremium"), { action: { label: t("swipe.upgrade"), onClick: () => navigate("premium") } });
      return;
    }
    if (superRallyUsed) return;
    setSuperRallyUsed(true);
    try { localStorage.setItem(superRallyKey, "1"); } catch { /* ignored */ }
    setExitDir("right");
    setAnimating(true);
    swipeMutation.mutate({
      swipedId: currentPlayer.id,
      direction: "rally",
      isSuperRally: true,
    });
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (animating || !canSwipe) return;
    isDragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [animating, canSwipe]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    dragXRef.current = dx;
    setDragX(dx);
    setDragY(dy * 0.3);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const currentDragX = dragXRef.current;
    if (Math.abs(currentDragX) > SWIPE_THRESHOLD) {
      handleSwipeRef.current(currentDragX > 0 ? "right" : "left");
    } else {
      setDragX(0);
      setDragY(0);
    }
    dragXRef.current = 0;
  }, []);

  if (!user) return null;

  if (candidatesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
          <p className="text-sm text-muted-foreground">{t("swipe.findingPlayers")}</p>
        </div>
      </div>
    );
  }

  if (candidatesQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <QueryError message={t("swipe.couldntLoadPlayers")} onRetry={() => candidatesQuery.refetch()} />
      </div>
    );
  }

  const swipePercent = user.isPremium ? 100 : Math.max(0, (Number(swipesRemaining) / maxSwipes) * 100);
  const rotation = dragX * 0.08;
  const rallyOpacity = Math.min(1, Math.max(0, dragX / SWIPE_THRESHOLD));
  const passOpacity = Math.min(1, Math.max(0, -dragX / SWIPE_THRESHOLD));

  return (
    <>
    <div className="pb-20 min-h-screen flex flex-col">
      {/* Compact Header */}
      <div className="px-4 pt-5 pb-2 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{t("swipe.title")}</h1>
          <p className="text-[10px] text-muted-foreground">
            {t("swipe.playersNearby", { count: candidates.length - swipeIndex })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(v => !v)} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", showFilters ? "bg-primary/20 text-primary" : "bg-muted/10 text-muted-foreground hover:bg-muted/20")}>
            <SlidersHorizontal size={16} />
          </button>
          <div className="relative w-10 h-10">
            <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
              <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/20" />
              <circle cx="20" cy="20" r="16" fill="none" strokeWidth="2.5" strokeDasharray={`${swipePercent} ${100 - swipePercent}`} strokeLinecap="round" className="text-primary transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {user.isPremium ? (
                <Crown size={12} className="text-secondary" />
              ) : (
                <span className="text-[10px] font-bold stat-number">{swipesRemaining}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-4 pb-3 animate-slide-up">
          <div className="card-elevated rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{t("swipe.filters", "Filters")}</h3>
              <button onClick={() => { setFilterRadius(25); setFilterVibe(""); setFilterSkill(""); setFilterAgeMin(18); setFilterAgeMax(99); }} className="text-[10px] text-primary font-medium">{t("swipe.resetFilters", "Reset")}</button>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("swipe.distance", "Distance")} — {filterRadius} mi</label>
              <input type="range" min={1} max={100} value={filterRadius} onChange={e => setFilterRadius(Number(e.target.value))} className="w-full accent-primary h-1.5" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("swipe.vibeFilter", "Vibe")}</label>
              <div className="flex gap-1.5">
                {["", "social", "competitive", "both"].map(v => (
                  <button key={v} onClick={() => setFilterVibe(v)} className={cn("px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all", filterVibe === v ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground")}>
                    {v === "" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn(!user?.isPremium && "opacity-50")}>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                {t("swipe.skillFilter", "Skill Level")} {!user?.isPremium && <Crown size={9} className="inline text-secondary ml-1" />}
              </label>
              <div className="flex gap-1 flex-wrap">
                {["", "Beginner", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0+"].map(s => (
                  <button key={s} onClick={() => { if (!user?.isPremium) { navigate("premium"); return; } setFilterSkill(s); }} className={cn("px-2 py-1 rounded-lg text-[10px] font-medium transition-all", filterSkill === s ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground")}>
                    {s || "All"}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn(!user?.isPremium && "opacity-50")}>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                {t("swipe.ageFilter", "Age Range")} — {filterAgeMin}–{filterAgeMax} {!user?.isPremium && <Crown size={9} className="inline text-secondary ml-1" />}
              </label>
              <div className="flex gap-2 items-center">
                <input type="range" min={18} max={99} value={filterAgeMin} onChange={e => { if (!user?.isPremium) { navigate("premium"); return; } setFilterAgeMin(Math.min(Number(e.target.value), filterAgeMax)); }} className="flex-1 accent-primary h-1.5" />
                <input type="range" min={18} max={99} value={filterAgeMax} onChange={e => { if (!user?.isPremium) { navigate("premium"); return; } setFilterAgeMax(Math.max(Number(e.target.value), filterAgeMin)); }} className="flex-1 accent-primary h-1.5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Area */}
      <div className="flex-1 flex flex-col items-center px-3 min-h-0 py-2">
        {outOfCards ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 animate-slide-up">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/10 flex items-center justify-center mx-auto">
              <PKLBallIcon size={52} />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1.5">{t("swipe.noMorePlayers")}</h2>
              <p className="text-muted-foreground text-sm">{t("swipe.noMorePlayersDesc")}</p>
            </div>
            <Button onClick={() => navigate("nearby")} variant="outline" className="mt-2 gap-2">
              <MapPin size={15} /> {t("swipe.browseNearby")}
            </Button>

            {/* Premium Re-match Section */}
            {user?.isPremium && unmatchedUsers.length > 0 && (
              <div className="w-full mt-4 space-y-2">
                <h3 className="text-sm font-bold text-secondary flex items-center gap-1.5">
                  <RotateCcw size={14} /> {t("swipe.secondChances", "Second Chances")}
                </h3>
                <p className="text-[11px] text-muted-foreground">{t("swipe.rematchDesc", "Give these players another chance!")}</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {unmatchedUsers.slice(0, 5).map((um: any) => (
                    <div key={um.matchId} className="flex items-center gap-3 p-2.5 rounded-xl card-elevated">
                      <PlayerAvatar user={um.user} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{getDisplayName(um.user)}</p>
                        {um.user.skillLevel && <p className="text-[10px] text-muted-foreground capitalize">{um.user.skillLevel}</p>}
                      </div>
                      <Button
                        size="sm"
                        className="text-[10px] h-7 bg-gradient-to-r from-secondary to-secondary/80 text-background gap-1"
                        onClick={() => rematchMutation.mutate({ matchId: um.matchId })}
                        disabled={rematchMutation.isPending}
                      >
                        <RotateCcw size={10} /> {t("swipe.rematch", "Re-match")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !canSwipe ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 animate-slide-up">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-secondary/15 to-secondary/10 flex items-center justify-center mx-auto">
              <span className="text-5xl">&#9203;</span>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1.5">{t("swipe.dailyLimitReached")}</h2>
              <p className="text-muted-foreground text-sm">{t("swipe.dailyLimitDesc")}</p>
            </div>
            <Button onClick={() => navigate("premium")} className="mt-2 bg-gradient-to-r from-secondary to-secondary/80 text-background gap-2 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
              <Crown size={16} /> {t("swipe.goPremium")}
            </Button>
          </div>
        ) : (
          <div className="relative w-full max-w-md flex-1 h-full">
            {nextPlayer && (
              <div className="absolute inset-2 scale-[0.95] opacity-30 blur-[0.5px]">
                <PlayerCard player={nextPlayer} />
              </div>
            )}
            {currentPlayer && (
              <div
                ref={cardRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={cn(
                  "absolute inset-0 z-10 touch-none select-none",
                  exitDir === "right" && "animate-swipe-right",
                  exitDir === "left" && "animate-swipe-left",
                )}
                style={!exitDir ? {
                  transform: `translate(${dragX}px, ${dragY}px) rotate(${rotation}deg)`,
                  transition: isDragging.current ? "none" : "transform 0.2s ease-out",
                } : undefined}
              >
                <PlayerCard player={currentPlayer} />
                {(rallyOpacity > 0 || exitDir === "right") && (
                  <div
                    className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none"
                    style={{ opacity: exitDir === "right" ? 1 : rallyOpacity }}
                  >
                    <div className="border-4 border-green-400 rounded-2xl px-8 py-3 rotate-[-15deg] bg-green-500/10 backdrop-blur-sm">
                      <span className="text-green-400 text-4xl font-black tracking-wider">{t("swipe.rally")}</span>
                    </div>
                  </div>
                )}
                {(passOpacity > 0 || exitDir === "left") && (
                  <div
                    className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none"
                    style={{ opacity: exitDir === "left" ? 1 : passOpacity }}
                  >
                    <div className="border-4 border-red-400 rounded-2xl px-8 py-3 rotate-[15deg] bg-red-500/10 backdrop-blur-sm">
                      <span className="text-red-400 text-4xl font-black tracking-wider">{t("swipe.pass")}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {!outOfCards && canSwipe && currentPlayer && (
        <div className="flex items-center justify-center gap-3 py-2 px-5 flex-shrink-0">
          {user?.isPremium && swipeIndex > 0 && (
            <button
              onClick={() => undoMutation.mutate()}
              disabled={undoMutation.isPending}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 border border-blue-500/30 flex flex-col items-center justify-center text-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all active:scale-90"
            >
              <RotateCcw size={16} />
              <span className="text-[6px] font-bold uppercase tracking-wider">{t("swipe.undo", "Undo")}</span>
            </button>
          )}
          <button
            onClick={() => handleSwipe("left")}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/15 to-red-600/10 border border-red-500/30 flex items-center justify-center text-red-400 hover:from-red-500/25 hover:to-red-600/15 hover:shadow-[0_0_24px_rgba(239,68,68,0.15)] transition-all active:scale-90"
          >
            <X size={28} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => handleSwipe("right")}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/15 to-emerald-600/10 border border-green-500/30 flex items-center justify-center text-green-400 hover:from-green-500/25 hover:to-emerald-600/15 hover:shadow-[0_0_24px_rgba(34,197,94,0.15)] transition-all active:scale-90"
          >
            <Heart size={28} strokeWidth={2.5} />
          </button>

          <button
            onClick={handleSuperRally}
            disabled={user?.isPremium ? superRallyUsed : false}
            className={cn(
              "w-11 h-11 rounded-xl flex flex-col items-center justify-center transition-all",
              !user?.isPremium
                ? "bg-gradient-to-br from-secondary/15 to-orange-500/10 border border-secondary/30 text-secondary hover:shadow-[0_0_20px_rgba(255,215,0,0.15)] active:scale-90 relative"
                : superRallyUsed
                  ? "bg-muted/10 text-muted-foreground/30 cursor-not-allowed"
                  : "bg-gradient-to-br from-secondary/15 to-orange-500/10 border border-secondary/30 text-secondary hover:shadow-[0_0_20px_rgba(255,215,0,0.15)] active:scale-90"
            )}
          >
            <Sparkles size={16} />
            {!user?.isPremium ? (
              <span className="text-[6px] font-bold uppercase tracking-wider flex items-center gap-0.5"><Crown size={7} />{t("swipe.pro")}</span>
            ) : !superRallyUsed ? (
              <span className="text-[6px] font-bold uppercase tracking-wider">{t("swipe.super")}</span>
            ) : null}
          </button>
        </div>
      )}
    </div>

    {matchData && (
      <MatchCelebration
        player={matchData.player}
        onClose={() => setMatchData(null)}
        onMessage={() => {
          setMatchData(null);
          navigate("matches");
        }}
      />
    )}
    </>
  );
}

function PlayerCard({ player }: { player: any }) {
  const { t } = useTranslation();
  const displayName = getDisplayName(player);
  const initials = getInitials(player);
  const bgColor = player.hasProfilePhoto ? getAvatarColor(player.id) : getSilhouetteColor(player.gender);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos: string[] = player.photos?.length > 0
    ? player.photos.map((p: any) => p.photoUrl)
    : player.profilePhotoUrl
      ? [player.profilePhotoUrl]
      : [];

  const hasPhotos = photos.length > 0;
  const currentPhoto = photos[photoIndex] ?? null;

  const nextPhoto = () => { if (photoIndex < photos.length - 1) setPhotoIndex(photoIndex + 1); };
  const prevPhoto = () => { if (photoIndex > 0) setPhotoIndex(photoIndex - 1); };

  return (
    <div
      className="w-full h-full rounded-2xl overflow-hidden relative"
      style={{
        background: "linear-gradient(180deg, var(--card) 0%, color-mix(in oklch, var(--card), var(--primary) 4%) 100%)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06) inset",
      }}
    >
      <div
        className="absolute inset-0"
        style={!hasPhotos ? { background: `linear-gradient(160deg, ${bgColor}40 0%, ${bgColor}15 60%, transparent 100%)` } : undefined}
      >
        {hasPhotos && currentPhoto ? (
          <>
            <img src={currentPhoto} alt={displayName} className="w-full h-full object-cover" />
            {photos.length > 1 && (
              <>
                <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={(e) => { e.stopPropagation(); prevPhoto(); }} />
                <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={(e) => { e.stopPropagation(); nextPhoto(); }} />
                <div className="absolute top-2.5 left-0 right-0 flex justify-center gap-1 z-20 px-4">
                  {photos.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-0.5 rounded-full flex-1 transition-all",
                        i === photoIndex ? "bg-white" : "bg-white/30"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlayerAvatar user={player} size="xl" showBadges={false} className="w-32 h-32 rounded-[28px] shadow-2xl" />
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

      <div className="absolute top-3 right-3 flex gap-1.5 z-20">
        {player.isPremium && (
          <span className="bg-secondary/20 text-secondary p-1.5 rounded-lg backdrop-blur-md">
            <Crown size={14} />
          </span>
        )}
        {player.isPhotoVerified && (
          <span className="bg-green-500/20 text-green-400 p-1.5 rounded-lg backdrop-blur-md">
            <CheckCircle size={14} />
          </span>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">{displayName}</h2>
              {player.age && <span className="text-white/80 text-xl font-light">{player.age}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin size={12} className="text-white/70" />
              <span className="text-xs text-white/70 font-medium">
                {player.distance != null ? (player.distance < 1 ? `${(player.distance * 5280).toFixed(0)} ft` : `${player.distance.toFixed(1)} mi`) : t("swipe.nearby")}
              </span>
              {player.averageRating > 0 && (
                <>
                  <span className="text-white/40 mx-1">&middot;</span>
                  <Star size={11} className="text-secondary fill-secondary" />
                  <span className="text-xs text-white/80">{player.averageRating?.toFixed(1)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-primary/30 text-white text-[10px] font-medium backdrop-blur-sm capitalize">{player.skillLevel || "Beginner"}</span>
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/30 text-white text-[10px] font-medium backdrop-blur-sm capitalize">{player.vibe || "social"}</span>
          {player.handedness && <span className="px-2 py-0.5 rounded-full bg-white/15 text-white text-[10px] font-medium backdrop-blur-sm capitalize">&#9995; {player.handedness}</span>}
        </div>

        {player.bio && (
          <p className="text-sm text-white/80 leading-relaxed line-clamp-2 mb-2">{player.bio}</p>
        )}

        <div className="flex gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 backdrop-blur-sm">
            <Trophy size={11} className="text-secondary" />
            <span className="text-[10px] text-white/90 font-medium">{player.totalWins || 0}W / {player.totalGames || 0}G</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 backdrop-blur-sm">
            <Flame size={11} className="text-secondary" />
            <span className="text-[10px] text-white/90 font-medium">{player.currentStreak || 0}d streak</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 backdrop-blur-sm">
            <Target size={11} className="text-secondary" />
            <span className="text-[10px] text-white/90 font-medium">Lvl {player.level || 1}</span>
          </div>
        </div>

        {player.playStyle && (
          <div className="flex flex-wrap gap-1 mt-2">
            {String(player.playStyle).split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 3).map((style: string) => (
              <span key={style} className="text-[9px] px-2 py-0.5 rounded-full bg-accent/20 text-white/80 font-medium backdrop-blur-sm">
                {style}
              </span>
            ))}
          </div>
        )}

        {player.endorsementCounts && Object.keys(player.endorsementCounts).length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <ThumbsUp size={10} className="text-green-400" />
            <div className="flex gap-1 flex-wrap">
              {Object.entries(player.endorsementCounts as Record<string, number>).slice(0, 3).map(([type, count]) => (
                <span key={type} className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium backdrop-blur-sm capitalize">
                  {type.replace(/-/g, " ")} ×{count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
