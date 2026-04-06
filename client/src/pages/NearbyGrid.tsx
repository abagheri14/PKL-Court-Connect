import { useTranslation } from "react-i18next";
import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { useGeolocation } from "@/hooks/useGeolocation";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName } from "@/lib/avatarUtils";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { MapPin, Search, Star, Loader2, AlertCircle, RefreshCw, MessageCircle, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function NearbyGrid() {
  const { t } = useTranslation();
  const { user, selectPlayer, navigate, selectMatch } = useApp();
  const { lat, lng } = useGeolocation({ fallbackLat: user?.latitude, fallbackLng: user?.longitude });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);

  const nearbyQuery = trpc.users.getNearby.useQuery(
    { lat, lng, radiusMiles: 25, minRating },
    { refetchInterval: 60000, enabled: !!(lat && lng) }
  );
  const nearbyPlayers = nearbyQuery.data ?? [];

  const sorted = [...nearbyPlayers]
    .sort((a: any, b: any) => (a.distance ?? 0) - (b.distance ?? 0))
    .filter((p: any) => {
      if (search) {
        const q = search.toLowerCase();
        const name = getDisplayName(p).toLowerCase();
        return name.includes(q) || (p.skillLevel || "").includes(q) || (p.vibe || "").toLowerCase().includes(q);
      }
      return true;
    })
    .filter((p: any) => {
      if (filter === "social") return (p.vibe || "").toLowerCase() === "social" || (p.vibe || "").toLowerCase() === "both";
      if (filter === "competitive") return (p.vibe || "").toLowerCase() === "competitive" || (p.vibe || "").toLowerCase() === "both";
      return true;
    })
    .filter((p: any) => {
      if (!skillFilter) return true;
      const sl = (p.skillLevel || "").toLowerCase();
      if (skillFilter === "beginner") return sl === "beginner" || sl === "1.0" || sl === "2.0" || sl === "2.5";
      if (skillFilter === "intermediate") return sl === "intermediate" || sl === "3.0" || sl === "3.5";
      if (skillFilter === "advanced") return sl === "advanced" || sl === "4.0" || sl === "4.5";
      if (skillFilter === "pro") return sl === "pro" || sl === "5.0" || sl === "5.0+";
      return true;
    });

  const startDmMutation = trpc.chat.startDirectMessage.useMutation({
    onSuccess: (data) => {
      selectMatch(null, data.conversationId);
    },
    onError: (err: any) => {
      if (err?.data?.code !== "FORBIDDEN") {
        toast.error(t("common.somethingWentWrong"));
      }
    },
  });

  // Check existing matches to bypass premium gate
  const matchesQuery = trpc.matches.list.useQuery();
  const matchesByUserId = new Map((matchesQuery.data ?? []).map((m: any) => [m.user?.id, m]));

  const handleMessagePlayer = (e: React.MouseEvent, playerId: number) => {
    e.stopPropagation();
    // If already matched, go to existing conversation
    const existingMatch = matchesByUserId.get(playerId);
    if (existingMatch?.conversationId) {
      selectMatch(existingMatch.id, existingMatch.conversationId);
      return;
    }
    if (!user?.isPremium) {
      toast(t("nearby.premiumRequired"), {
        description: t("nearby.premiumMessageDesc"),
        action: { label: t("nearby.upgrade"), onClick: () => navigate("premium") },
        icon: <Crown size={16} className="text-secondary" />,
      });
      return;
    }
    startDmMutation.mutate({ targetUserId: playerId });
  };

  if (nearbyQuery.isLoading) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (nearbyQuery.isError) {
    return (
      <div className="pb-24 min-h-screen flex flex-col items-center justify-center gap-3 px-6">
        <AlertCircle size={32} className="text-destructive/60" />
        <p className="text-sm font-medium text-muted-foreground">{t("common.loadError")}</p>
        <button
          onClick={() => nearbyQuery.refetch()}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <RefreshCw size={12} /> {t("common.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-primary/8 blur-3xl" />
        <div className="relative px-5 pt-7 pb-2">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold tracking-tight">{t("nearby.title")}</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/10 px-2.5 py-1 rounded-lg">
              <MapPin size={11} className="text-secondary" />
              {user?.city}, {user?.region}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("nearby.playersInArea", { count: nearbyPlayers.length })}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-5 mb-4 space-y-2.5 animate-slide-up">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("nearby.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {([{ label: t("nearby.filterAll"), value: null as string | null }, { label: t("nearby.filterSocial"), value: "social" }, { label: t("nearby.filterCompetitive"), value: "competitive" }]).map(f => (
            <button key={f.label} onClick={() => setFilter(f.value)}
              className={cn("text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all",
                filter === f.value
                  ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}
            >{f.label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { label: t("nearby.allLevels"), value: null },
            { label: t("nearby.beginner"), value: "beginner" },
            { label: t("nearby.intermediate"), value: "intermediate" },
            { label: t("nearby.advanced"), value: "advanced" },
            { label: t("nearby.pro"), value: "pro" },
          ].map(s => (
            <button key={s.label} onClick={() => setSkillFilter(s.value)}
              className={cn("text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all",
                skillFilter === s.value
                  ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}
            >{s.label}</button>
          ))}
        </div>
        {user?.isPremium && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {[
              { label: t("nearby.anyRating"), value: undefined as number | undefined },
              { label: "3.0+", value: 3.0 },
              { label: "3.5+", value: 3.5 },
              { label: "4.0+", value: 4.0 },
              { label: "4.5+", value: 4.5 },
            ].map(r => (
              <button key={r.label} onClick={() => setMinRating(r.value)}
                className={cn("text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all",
                  minRating === r.value
                    ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                )}
              >
                <Star size={10} className="inline mr-1" />{r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="px-5 grid grid-cols-2 gap-2.5">
        {sorted.map((player, i) => (
          <button
            key={player.id}
            onClick={() => selectPlayer(player.id)}
            className={cn("card-elevated rounded-xl p-3 text-left transition-all active:scale-[0.97] hover:scale-[1.01] animate-slide-up",
              i < 2 ? "delay-100" : i < 4 ? "delay-200" : "delay-300"
            )}
          >
            <div className="flex items-start gap-2.5 mb-2">
              <PlayerAvatar user={player} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{getDisplayName(player)}</p>
                <p className="text-[10px] text-muted-foreground">{player.age}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 mb-1.5 text-[10px] text-muted-foreground">
              <MapPin size={10} className="text-secondary" />
              <span>{player.distance != null ? (player.distance < 1 ? `${(player.distance * 5280).toFixed(0)} ft` : `${player.distance.toFixed(1)} mi`) : t("nearby.nearby")}</span>
            </div>

            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="sport-badge sport-badge-purple text-[9px] py-0 capitalize">{player.skillLevel}</span>
              <span className="sport-badge text-[9px] py-0 capitalize">{player.vibe}</span>
            </div>

            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {player.averageRating > 0 && (
                <>
                  <Star size={10} className="text-secondary fill-secondary" />
                  <span>{player.averageRating?.toFixed(1)}</span>
                  <span className="text-muted-foreground/40 mx-0.5">·</span>
                </>
              )}
              <span>{player.totalWins ?? 0}W / {player.totalGames ?? 0}G</span>
            </div>

            {/* Message button */}
            <div
              onClick={(e) => handleMessagePlayer(e, player.id)}
              className="mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors"
            >
              <MessageCircle size={11} />
              {t("nearby.message")}
              {!user?.isPremium && !matchesByUserId.has(player.id) && <Crown size={9} className="text-secondary" />}
            </div>
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12 animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center mx-auto mb-3">
            <Search size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t("nearby.noPlayersFound")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{t("nearby.adjustFilters")}</p>
        </div>
      )}
    </div>
  );
}
