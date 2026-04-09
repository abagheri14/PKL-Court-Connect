import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trophy, Users, Calendar, MapPin, Search, Loader2, ChevronRight, Crown, Filter, Clock, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { QueryError } from "@/components/QueryError";
import PlayerAvatar from "@/components/PlayerAvatar";
import { useTranslation } from "react-i18next";

const STATUS_TABS = ["all", "registration", "in-progress", "completed"] as const;
type StatusTab = typeof STATUS_TABS[number];

const formatIcons: Record<string, string> = {
  "single-elimination": "🏆",
  "double-elimination": "🔄",
  "round-robin": "🔁",
};

export default function TournamentsScreen() {
  const { user, navigate, goBack, selectTournament } = useApp();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [view, setView] = useState<"all" | "mine">("all");

  const allQuery = trpc.tournaments.list.useQuery(
    activeTab === "all" ? {} : { status: activeTab },
    { enabled: view === "all", refetchInterval: 30000 }
  );
  const myQuery = trpc.tournaments.myTournaments.useQuery(undefined, {
    enabled: view === "mine",
    refetchInterval: 30000,
  });

  const tournaments: any[] = view === "mine" ? (myQuery.data ?? []) : (allQuery.data ?? []);
  const activeQuery = view === "mine" ? myQuery : allQuery;

  const filtered = useMemo(() => {
    if (!search.trim()) return tournaments;
    const q = search.toLowerCase();
    return tournaments.filter((t: any) =>
      t.name?.toLowerCase().includes(q) || t.locationName?.toLowerCase().includes(q)
    );
  }, [tournaments, search]);

  const formatDate = (d: string | Date | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "registration": return "bg-[#BFFF00]/20 text-[#BFFF00] border-[#BFFF00]/30";
      case "in-progress": return "bg-[#FFC107]/20 text-[#FFC107] border-[#FFC107]/30";
      case "completed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "cancelled": return "bg-[#dc3545]/20 text-[#dc3545] border-[#dc3545]/30";
      case "draft": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} aria-label="Go back" className="p-1 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#FFC107]" />
              <h1 className="text-lg font-bold">Tournaments</h1>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate("createTournament")} className="gap-1 bg-[#FFC107] text-[#1a1d2e] hover:bg-[#e0a800]">
            <Plus className="w-4 h-4" /> Create
          </Button>
        </div>

        {/* View toggle */}
        <div className="flex gap-2 mt-3">
          {(["mine", "all"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "mine" ? "My Tournaments" : "Browse All"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tournaments..."
            className="pl-9 bg-muted border-none"
          />
        </div>

        {/* Status tabs (only for "all" view) */}
        {view === "all" && (
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {STATUS_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "all" ? "All" : tab === "in-progress" ? "In Progress" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {activeQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {activeQuery.isError && (
          <QueryError message="Failed to load tournaments" onRetry={() => activeQuery.refetch()} />
        )}

        {!activeQuery.isLoading && filtered.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <Trophy className="w-16 h-16 mx-auto text-muted-foreground/30" />
            <div>
              <p className="text-lg font-medium text-muted-foreground">
                {view === "mine" ? "No tournaments yet" : "No tournaments found"}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {view === "mine" ? "Create or join a tournament to get started!" : "Try a different filter or create one!"}
              </p>
            </div>
            <Button onClick={() => navigate("createTournament")} className="gap-2 bg-[#FFC107] text-[#1a1d2e] hover:bg-[#e0a800]">
              <Plus className="w-4 h-4" /> Create Tournament
            </Button>
          </div>
        )}

        {filtered.map((t: any) => (
          <button
            key={t.id}
            onClick={() => selectTournament(t.id)}
            className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{formatIcons[t.format] || "🏓"}</span>
                  <h3 className="font-semibold truncate">{t.name}</h3>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", getStatusColor(t.status))}>
                    {t.status === "in-progress" ? "In Progress" : t.status?.charAt(0).toUpperCase() + t.status?.slice(1)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {t.format?.replace(/-/g, " ")}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {t.gameFormat?.replace(/-/g, " ")}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 mt-2.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {t.participantCount}/{t.maxParticipants}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(t.startDate)}
                  </span>
                  {t.locationName && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {t.locationName}
                    </span>
                  )}
                  {t.entryFee ? (
                    <span className="flex items-center gap-1 text-[#FFC107]">
                      ${t.entryFee}
                    </span>
                  ) : null}
                </div>

                {t.organizer && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <PlayerAvatar user={t.organizer} size="xs" />
                    <span className="text-xs text-muted-foreground">
                      by {t.organizer.nickname || t.organizer.name}
                    </span>
                    {t.organizerId === user?.id && (
                      <span className="flex items-center gap-0.5 text-xs text-[#FFC107]">
                        <Crown className="w-3 h-3" /> You
                      </span>
                    )}
                  </div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
