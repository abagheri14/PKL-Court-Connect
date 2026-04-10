import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Trophy, Users, Calendar, MapPin, Loader2, Crown, Play, Check,
  X, Clock, ChevronDown, ChevronRight, Shield, Swords, BarChart3, Settings,
  Share2, UserMinus, UserPlus, DollarSign, Info, AlertCircle, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { QueryError } from "@/components/QueryError";
import PlayerAvatar from "@/components/PlayerAvatar";
import TournamentBracket from "@/components/TournamentBracket";
import InvitePickerModal from "@/components/InvitePickerModal";

const TABS = ["bracket", "participants", "info", "manage"] as const;
type Tab = typeof TABS[number];

export default function TournamentDetailScreen() {
  const { user, goBack, selectPlayer, selectGame, selectedTournamentId } = useApp();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("bracket");
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: number; name: string } | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const tournamentId = selectedTournamentId!;
  const detailQuery = trpc.tournaments.getById.useQuery(
    { tournamentId },
    { enabled: !!tournamentId, refetchInterval: 10000 }
  );
  const bracketQuery = trpc.tournaments.getBracket.useQuery(
    { tournamentId },
    { enabled: !!tournamentId, refetchInterval: 10000 }
  );

  const utils = trpc.useUtils();
  const refetchAll = () => {
    detailQuery.refetch();
    bracketQuery.refetch();
  };

  const joinMutation = trpc.tournaments.join.useMutation({
    onSuccess: () => { toast.success(t("tournament.joined")); refetchAll(); },
    onError: (err) => toast.error(err.message),
  });
  const leaveMutation = trpc.tournaments.leave.useMutation({
    onSuccess: () => { toast.success(t("tournament.left")); refetchAll(); },
    onError: (err) => toast.error(err.message),
  });
  const seedBracketMutation = trpc.tournaments.seedBracket.useMutation({
    onSuccess: () => { toast.success(t("tournament.bracketGenerated")); refetchAll(); },
    onError: (err) => toast.error(err.message),
  });
  const startMatchMutation = trpc.tournaments.startMatch.useMutation({
    onSuccess: (data) => {
      toast.success(t("tournament.matchStarted"));
      refetchAll();
      // Navigate to the live game
      selectGame(data.gameId);
    },
    onError: (err) => toast.error(err.message),
  });
  const reportResultMutation = trpc.tournaments.reportResult.useMutation({
    onSuccess: (data) => {
      toast.success(data.tournamentComplete ? t("tournament.complete") : t("tournament.resultRecorded"));
      refetchAll();
    },
    onError: (err) => toast.error(err.message),
  });
  const approveParticipantMutation = trpc.tournaments.approveParticipant.useMutation({
    onSuccess: () => { toast.success(t("tournament.participantApproved")); refetchAll(); },
    onError: (err) => toast.error(err.message),
  });
  const removeParticipantMutation = trpc.tournaments.removeParticipant.useMutation({
    onSuccess: () => { toast.success(t("tournament.participantRemoved")); refetchAll(); },
    onError: (err) => toast.error(err.message),
  });
  const cancelMutation = trpc.tournaments.cancel.useMutation({
    onSuccess: () => { toast.success(t("tournament.cancelled")); goBack(); },
    onError: (err) => toast.error(err.message),
  });

  const tournament = detailQuery.data;
  const bracket = bracketQuery.data;

  if (!tournamentId) return null;

  if (detailQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (detailQuery.isError || !tournament) {
    return (
      <div className="min-h-screen bg-background p-4">
        <button onClick={goBack} className="p-1 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <QueryError message={t("tournament.loadFailed")} onRetry={refetchAll} />
      </div>
    );
  }

  const isOrganizer = tournament.organizerId === user?.id;
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isOrganizerOrAdmin = isOrganizer || isAdmin;
  const myParticipation = tournament.participants?.find((p: any) => p.userId === user?.id);
  const isParticipant = !!myParticipation && myParticipation.status !== "withdrawn";
  const confirmedParticipants = tournament.participants?.filter((p: any) => p.status === "confirmed") ?? [];
  const pendingParticipants = tournament.participants?.filter((p: any) => p.status === "registered") ?? [];
  const isRegistrationOpen = tournament.status === "registration";
  const canJoin = isRegistrationOpen && !isParticipant && !isOrganizer;
  const canSeedBracket = isOrganizerOrAdmin && (tournament.status === "registration" || tournament.status === "seeding") && confirmedParticipants.length >= 2;

  const formatDate = (d: string | Date | null) => {
    if (!d) return t("common.tbd");
    return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "registration": return "text-[#BFFF00]";
      case "in-progress": return "text-[#FFC107]";
      case "completed": return "text-blue-400";
      case "cancelled": return "text-[#dc3545]";
      default: return "text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{tournament.name}</h1>
              <p className={cn("text-xs font-medium", getStatusColor(tournament.status))}>
                {tournament.status === "in-progress" ? t("tournament.status.inProgress") : tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                {tournament.currentRound > 0 && ` • Round ${tournament.currentRound}/${tournament.totalRounds}`}
              </p>
            </div>
          </div>
        </div>

        {/* Tournament hero card */}
        <div className="px-4 pb-3">
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {tournament.participantCount}/{tournament.maxParticipants}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(tournament.startDate)}</span>
              {tournament.locationName && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {tournament.locationName}</span>}
              <span className="flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> {tournament.format?.replace(/-/g, " ")}</span>
              <span className="flex items-center gap-1">🏓 {tournament.gameFormat?.replace(/-/g, " ")}</span>
              {tournament.entryFee ? <span className="flex items-center gap-1 text-[#FFC107]"><DollarSign className="w-3.5 h-3.5" /> ${tournament.entryFee}</span> : null}
            </div>

            {tournament.organizer && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                <PlayerAvatar user={tournament.organizer} size="xs" />
                <span className="text-xs text-muted-foreground">
                  {t("tournament.organizedBy")} <strong>{tournament.organizer.nickname || tournament.organizer.name}</strong>
                </span>
              </div>
            )}

            {/* Winner banner */}
            {tournament.status === "completed" && tournament.winnerId && (
              <div className="mt-2 pt-2 border-t border-border flex items-center gap-2 text-[#FFC107]">
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  {t("tournament.winner")}: {tournament.participants?.find((p: any) => p.userId === tournament.winnerId)?.userNickname ||
                    tournament.participants?.find((p: any) => p.userId === tournament.winnerId)?.userName || t("common.unknown")}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {canJoin && (
              <Button
                onClick={() => joinMutation.mutate({ tournamentId })}
                disabled={joinMutation.isPending}
                className="flex-1 gap-2"
              >
                {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {t("tournament.joinButton")}
              </Button>
            )}
            {isParticipant && !isOrganizer && tournament.status === "registration" && (
              <Button
                variant="outline"
                onClick={() => leaveMutation.mutate({ tournamentId })}
                disabled={leaveMutation.isPending}
                className="flex-1 gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
              >
                {t("tournament.leaveButton")}
              </Button>
            )}
            {canSeedBracket && (
              <Button
                onClick={() => seedBracketMutation.mutate({ tournamentId })}
                disabled={seedBracketMutation.isPending}
                className="flex-1 gap-2"
              >
                {seedBracketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {t("tournament.generateBracket")}
              </Button>
            )}
            {isOrganizerOrAdmin && isRegistrationOpen && (
              <Button
                variant="outline"
                onClick={() => setShowInvite(true)}
                className="gap-2 border-[#FFC107]/30 text-[#FFC107] hover:bg-[#FFC107]/10"
              >
                <Send className="w-4 h-4" /> {t("tournament.invitePlayers")}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-border">
          {TABS.filter(tab => tab !== "manage" || isOrganizerOrAdmin).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors border-b-2",
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "bracket" ? t("tournament.tab.bracket") : tab === "participants" ? t("tournament.tab.participants") : tab === "info" ? t("tournament.tab.info") : t("tournament.tab.manage")}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Bracket Tab */}
        {activeTab === "bracket" && (
          <div>
            {tournament.status === "registration" || tournament.status === "draft" ? (
              <div className="text-center py-12 space-y-3">
                <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("tournament.bracketPending")}</p>
                <p className="text-xs text-muted-foreground/70">{t("tournament.confirmedPlayers", { count: confirmedParticipants.length })}</p>
              </div>
            ) : bracket ? (
              <TournamentBracket
                bracket={bracket}
                tournament={tournament}
                isOrganizer={isOrganizerOrAdmin}
                onStartMatch={(matchId: number) => startMatchMutation.mutate({ tournamentId, matchId })}
                onReportResult={(matchId: number, winnerId: number) => reportResultMutation.mutate({ tournamentId, matchId, winnerId })}
                onViewGame={(gameId: number) => selectGame(gameId)}
                startMatchPending={startMatchMutation.isPending}
                reportResultPending={reportResultMutation.isPending}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === "participants" && (
          <div className="space-y-3">
            {pendingParticipants.length > 0 && isOrganizerOrAdmin && (
              <div className="space-y-2 mb-4">
                <h3 className="text-sm font-semibold text-[#FFC107] flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {t("tournament.pendingApproval", { count: pendingParticipants.length })}
                </h3>
                {pendingParticipants.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between bg-card border border-[#FFC107]/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar user={{ id: p.userId, profilePhotoUrl: p.userPhoto, name: p.userName, nickname: p.userNickname }} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{p.userNickname || p.userName}</p>
                        {p.userSkillLevel && <p className="text-xs text-muted-foreground">{t("tournament.skill", { level: p.userSkillLevel })}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-400 hover:bg-green-500/10"
                        onClick={() => approveParticipantMutation.mutate({ tournamentId, participantId: p.id })}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10"
                        onClick={() => removeParticipantMutation.mutate({ tournamentId, participantId: p.id })}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> {t("tournament.confirmed", { count: confirmedParticipants.length })}
            </h3>
            {confirmedParticipants.map((p: any, idx: number) => (
              <button
                key={p.id}
                onClick={() => selectPlayer(p.userId)}
                className="w-full flex items-center gap-3 bg-card border border-border rounded-lg p-3 hover:border-primary/30 transition-all"
              >
                <span className="text-xs font-mono text-muted-foreground w-5">#{p.seed || idx + 1}</span>
                <PlayerAvatar user={{ id: p.userId, profilePhotoUrl: p.userPhoto, name: p.userName, nickname: p.userNickname }} size="sm" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{p.userNickname || p.userName}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {p.userSkillLevel && <span>Skill {p.userSkillLevel}</span>}
                    <span>{p.wins}W - {p.losses}L</span>
                    {p.placement && <span className="text-[#FFC107]">#{p.placement}</span>}
                  </div>
                </div>
                {p.userId === tournament.organizerId && (
                  <Crown className="w-4 h-4 text-[#FFC107]" />
                )}
                {p.status === "eliminated" && (
                  <span className="text-xs text-red-400">{t("tournament.eliminated")}</span>
                )}
              </button>
            ))}

            {confirmedParticipants.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t("tournament.noParticipants")}</p>
              </div>
            )}
          </div>
        )}

        {/* Info Tab */}
        {activeTab === "info" && (
          <div className="space-y-4">
            {tournament.description && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2">{t("tournament.descriptionHeading")}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.description}</p>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold">{t("tournament.gameRules")}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">{t("tournament.pointsToWin")}</div>
                <div className="font-medium">{tournament.pointsToWin}</div>
                <div className="text-muted-foreground">{t("tournament.bestOf")}</div>
                <div className="font-medium">{t("tournament.bestOfGames", { count: tournament.bestOf })}</div>
                <div className="text-muted-foreground">{t("tournament.winBy")}</div>
                <div className="font-medium">{t("tournament.winByPoints", { count: tournament.winBy })}</div>
                <div className="text-muted-foreground">{t("tournament.formatHeading")}</div>
                <div className="font-medium capitalize">{tournament.format?.replace(/-/g, " ")}</div>
                <div className="text-muted-foreground">{t("tournament.gameType")}</div>
                <div className="font-medium capitalize">{tournament.gameFormat?.replace(/-/g, " ")}</div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold">{t("tournament.schedule")}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">{t("tournament.start")}</div>
                <div className="font-medium">{formatDate(tournament.startDate)}</div>
                {tournament.endDate && <>
                  <div className="text-muted-foreground">{t("tournament.end")}</div>
                  <div className="font-medium">{formatDate(tournament.endDate)}</div>
                </>}
                {tournament.registrationDeadline && <>
                  <div className="text-muted-foreground">{t("tournament.regDeadline")}</div>
                  <div className="font-medium">{formatDate(tournament.registrationDeadline)}</div>
                </>}
              </div>
            </div>

            {(tournament.skillLevelMin || tournament.skillLevelMax) && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">{t("tournament.skillRequirements")}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {tournament.skillLevelMin && <>
                    <div className="text-muted-foreground">{t("common.minimum")}</div>
                    <div className="font-medium">{tournament.skillLevelMin}</div>
                  </>}
                  {tournament.skillLevelMax && <>
                    <div className="text-muted-foreground">{t("common.maximum")}</div>
                    <div className="font-medium">{tournament.skillLevelMax}</div>
                  </>}
                </div>
              </div>
            )}

            {tournament.prizeDescription && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#FFC107]" /> {t("tournament.prize")}
                </h3>
                <p className="text-sm text-muted-foreground">{tournament.prizeDescription}</p>
              </div>
            )}

            {tournament.rules && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2">{t("tournament.rulesHeading")}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.rules}</p>
              </div>
            )}
          </div>
        )}

        {/* Manage Tab (organizer or admin) */}
        {activeTab === "manage" && isOrganizerOrAdmin && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold">{t("tournament.statusHeading")}</h3>
              <p className={cn("text-sm font-medium", getStatusColor(tournament.status))}>
                {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
              </p>
              {tournament.status === "registration" && confirmedParticipants.length >= 2 && (
                <div className="pt-2">
                  <Button
                    onClick={() => seedBracketMutation.mutate({ tournamentId })}
                    disabled={seedBracketMutation.isPending}
                    className="w-full gap-2"
                  >
                    {seedBracketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {t("tournament.closeRegistration")}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {t("tournament.closeRegistrationDesc", { count: confirmedParticipants.length })}
                  </p>
                </div>
              )}
            </div>

            {tournament.status !== "completed" && tournament.status !== "cancelled" && (
              <div className="bg-card border border-red-500/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-red-400 mb-2">{t("tournament.dangerZone")}</h3>
                <Button
                  variant="outline"
                  onClick={() => setConfirmAction({ type: "cancel", id: tournamentId, name: tournament.name })}
                  className="w-full text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  {t("tournament.cancelButton")}
                </Button>
              </div>
            )}

            {/* Confirm dialog */}
            {confirmAction && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4">
                  <h3 className="font-semibold">{t("tournament.cancelConfirmTitle")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("tournament.cancelConfirmDesc", { name: confirmAction.name })}
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setConfirmAction(null)} className="flex-1">
                      {t("tournament.keep")}
                    </Button>
                    <Button
                      onClick={() => {
                        cancelMutation.mutate({ tournamentId });
                        setConfirmAction(null);
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {t("tournament.cancelIt")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <InvitePickerModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        targetType="tournament"
        targetId={tournamentId}
        targetName={tournament?.name}
      />
    </div>
  );
}
