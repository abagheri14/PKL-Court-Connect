import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, Clock, GraduationCap, Loader2, Swords, X, Gamepad2, Send, Inbox, Bell, ChevronRight, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";
import { useTranslation } from "react-i18next";
import PlayerAvatar from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";
import { useState } from "react";

function timeAgo(dateStr: string | undefined | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PendingRequestsScreen() {
  const { goBack } = useApp();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");

  const pendingQuery = trpc.challenges.allPending.useQuery(undefined, { refetchInterval: 15000 });
  const data = pendingQuery.data;

  const respondChallengeMutation = trpc.challenges.respond.useMutation({
    onSuccess: (_d, vars) => {
      utils.challenges.allPending.invalidate();
      utils.challenges.pending.invalidate();
      utils.games.upcoming.invalidate();
      utils.games.list.invalidate();
      toast.success(vars.accept ? t("pending.challengeAccepted") : t("pending.challengeDeclined"));
    },
    onError: (err) => toast.error(err.message),
  });

  const approveGameMutation = trpc.games.approveParticipant.useMutation({
    onSuccess: () => {
      utils.challenges.allPending.invalidate();
      utils.games.upcoming.invalidate();
      utils.games.list.invalidate();
      toast.success(t("pending.playerApproved"));
    },
    onError: (err) => toast.error(err.message),
  });

  const declineGameMutation = trpc.games.declineParticipant.useMutation({
    onSuccess: () => {
      utils.challenges.allPending.invalidate();
      utils.games.upcoming.invalidate();
      utils.games.list.invalidate();
      toast(t("pending.playerDeclined"));
    },
    onError: (err) => toast.error(err.message),
  });

  const approveCoachingMutation = trpc.coaching.approveParticipant.useMutation({
    onSuccess: () => {
      utils.challenges.allPending.invalidate();
      toast.success(t("pending.playerApproved"));
    },
  });

  const declineCoachingMutation = trpc.coaching.declineParticipant.useMutation({
    onSuccess: () => {
      utils.challenges.allPending.invalidate();
      toast(t("pending.playerDeclined"));
    },
  });

  const cancelChallengeMutation = trpc.challenges.respond.useMutation({
    onSuccess: () => {
      utils.challenges.allPending.invalidate();
      toast.success(t("pending.challengeCancelled") || "Challenge withdrawn");
    },
    onError: (err) => toast.error(err.message),
  });

  const challenges = data?.challenges ?? [];
  const gameRequests = data?.gameRequests ?? [];
  const coachingRequests = data?.coachingRequests ?? [];
  const sentChallenges = data?.sentChallenges ?? [];
  const myGameRequests = data?.myGameRequests ?? [];
  const myCoachingRequests = data?.myCoachingRequests ?? [];

  const incomingCount = challenges.length + gameRequests.length + coachingRequests.length;
  const outgoingCount = sentChallenges.length + myGameRequests.length + myCoachingRequests.length;
  const totalCount = incomingCount + outgoingCount;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="p-2 -ml-2 rounded-xl hover:bg-muted/50 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{t("pending.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("pending.countPending", { count: totalCount })}</p>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/15">
              <Bell size={13} className="text-secondary" />
              <span className="text-xs font-bold text-secondary">{totalCount}</span>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        {totalCount > 0 && (
          <div className="px-4 pb-3 flex gap-2">
            <button
              onClick={() => setActiveTab("incoming")}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                activeTab === "incoming"
                  ? "pill-tab-active text-white"
                  : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}
            >
              <Inbox size={13} />
              {t("pending.incoming")} {incomingCount > 0 && <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">{incomingCount}</span>}
            </button>
            <button
              onClick={() => setActiveTab("outgoing")}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                activeTab === "outgoing"
                  ? "pill-tab-active text-white"
                  : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
              )}
            >
              <Send size={13} />
              {t("pending.outgoing")} {outgoingCount > 0 && <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">{outgoingCount}</span>}
            </button>
          </div>
        )}
      </div>

      {pendingQuery.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      )}

      {pendingQuery.isError && (
        <div className="p-6">
          <QueryError message={t("pending.loadError")} onRetry={() => pendingQuery.refetch()} />
        </div>
      )}

      {pendingQuery.data && totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
            <Inbox size={36} className="text-muted-foreground/50" />
          </div>
          <h3 className="font-bold text-lg mb-1">{t("All Caught Up!")}</h3>
          <p className="text-sm text-muted-foreground max-w-[240px]">{t("No pending requests right now. Challenges and game requests will appear here.")}</p>
        </div>
      )}

      <div className="px-4 space-y-4 mt-4">

        {/* ═══ INCOMING TAB ═══ */}
        {activeTab === "incoming" && (
          <>
            {incomingCount === 0 && totalCount > 0 && (
              <div className="text-center py-12">
                <Inbox size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{t("No incoming requests")}</p>
              </div>
            )}

            {/* Challenges Received */}
            {challenges.length > 0 && (
              <section>
                <SectionHeader icon={Swords} label={t("Challenges Received")} count={challenges.length} color="text-secondary" bg="bg-secondary/15" />
                <div className="space-y-2.5">
                  {challenges.map((c: any) => (
                    <div key={c.id} className="card p-4 rounded-2xl border border-border/50 hover:border-secondary/30 transition-all">
                      <div className="flex items-start gap-3">
                        <PlayerAvatar
                          user={{
                            id: c.challengerUserId || c.id,
                            name: c.challengerNickname || c.challengerName || c.challengerUsername || "Player",
                            profilePhotoUrl: c.challengerProfilePhotoUrl,
                            hasProfilePhoto: !!c.challengerProfilePhotoUrl,
                          }}
                          size="md"
                          showBadges={false}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm truncate">
                              {c.challengerNickname || c.challengerName || c.challengerUsername || "Unknown"}
                            </p>
                            {c.createdAt && (
                              <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{timeAgo(c.createdAt)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize">{c.gameType}</span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground capitalize">{c.format?.replace(/-/g, " ")}</span>
                          </div>
                          {c.message && (
                            <p className="text-xs text-muted-foreground/70 italic truncate">"{c.message}"</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 ml-[3.75rem]">
                        <button
                          onClick={() => respondChallengeMutation.mutate({ challengeId: c.id, accept: false })}
                          disabled={respondChallengeMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted/20 border border-border text-muted-foreground text-xs font-semibold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
                        >
                          <X size={14} /> {t("Decline")}
                        </button>
                        <button
                          onClick={() => respondChallengeMutation.mutate({ challengeId: c.id, accept: true })}
                          disabled={respondChallengeMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary/20 text-secondary text-xs font-bold hover:bg-secondary/30 transition-all"
                        >
                          <Check size={14} /> {t("Accept")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Game Join Requests */}
            {gameRequests.length > 0 && (
              <section>
                <SectionHeader icon={Gamepad2} label={t("Game Join Requests")} count={gameRequests.length} color="text-primary" bg="bg-primary/15" />
                <div className="space-y-2.5">
                  {gameRequests.map((r: any, i: number) => (
                    <div key={`game-${r.gameId}-${r.userId}-${i}`} className="card p-4 rounded-2xl border border-border/50 hover:border-primary/30 transition-all">
                      <div className="flex items-start gap-3">
                        <PlayerAvatar
                          user={{
                            id: r.userId,
                            name: r.userName || r.userUsername || "Player",
                            profilePhotoUrl: r.userProfilePhotoUrl,
                            hasProfilePhoto: !!r.userProfilePhotoUrl,
                          }}
                          size="md"
                          showBadges={false}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm truncate">{r.userName || r.userUsername || t("common.player")}</p>
                            {r.createdAt && <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{timeAgo(r.createdAt)}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{t("pending.wantsToJoin", { title: r.gameName || t("common.game") })}</p>
                          {r.scheduledAt && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/60">
                              <Calendar size={10} />
                              <span>{new Date(r.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 ml-[3.75rem]">
                        <button
                          onClick={() => declineGameMutation.mutate({ gameId: r.gameId, userId: r.userId })}
                          disabled={declineGameMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted/20 border border-border text-muted-foreground text-xs font-semibold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
                        >
                          <X size={14} /> {t("Decline")}
                        </button>
                        <button
                          onClick={() => approveGameMutation.mutate({ gameId: r.gameId, userId: r.userId })}
                          disabled={approveGameMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30 transition-all"
                        >
                          <Check size={14} /> {t("Approve")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Coaching Join Requests */}
            {coachingRequests.length > 0 && (
              <section>
                <SectionHeader icon={GraduationCap} label={t("Coaching Requests")} count={coachingRequests.length} color="text-primary" bg="bg-primary/15" />
                <div className="space-y-2.5">
                  {coachingRequests.map((r: any, i: number) => (
                    <div key={`coach-${r.coachingId}-${r.userId}-${i}`} className="card p-4 rounded-2xl border border-border/50 hover:border-primary/30 transition-all">
                      <div className="flex items-start gap-3">
                        <PlayerAvatar
                          user={{
                            id: r.userId,
                            name: r.userName || r.userUsername || "Player",
                            profilePhotoUrl: r.userProfilePhotoUrl,
                            hasProfilePhoto: !!r.userProfilePhotoUrl,
                          }}
                          size="md"
                          showBadges={false}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm truncate">{r.userName || r.userUsername || t("common.player")}</p>
                            {r.createdAt && <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{timeAgo(r.createdAt)}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{t("pending.wantsToJoin", { title: r.sessionTitle || t("common.coaching") })}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 ml-[3.75rem]">
                        <button
                          onClick={() => declineCoachingMutation.mutate({ coachingId: r.coachingId, userId: r.userId })}
                          disabled={declineCoachingMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted/20 border border-border text-muted-foreground text-xs font-semibold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
                        >
                          <X size={14} /> {t("Decline")}
                        </button>
                        <button
                          onClick={() => approveCoachingMutation.mutate({ coachingId: r.coachingId, userId: r.userId })}
                          disabled={approveCoachingMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30 transition-all"
                        >
                          <Check size={14} /> {t("Approve")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ═══ OUTGOING TAB ═══ */}
        {activeTab === "outgoing" && (
          <>
            {outgoingCount === 0 && totalCount > 0 && (
              <div className="text-center py-12">
                <Send size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{t("No outgoing requests")}</p>
              </div>
            )}

            {/* Challenges Sent */}
            {sentChallenges.length > 0 && (
              <section>
                <SectionHeader icon={Swords} label={t("Challenges Sent")} count={sentChallenges.length} color="text-muted-foreground" bg="bg-muted/20" />
                <div className="space-y-2.5">
                  {sentChallenges.map((c: any) => (
                    <div key={c.id} className="card p-4 rounded-2xl border border-border/50">
                      <div className="flex items-start gap-3">
                        <PlayerAvatar
                          user={{
                            id: c.challengedUserId || c.id,
                            name: c.challengedName || c.challengedUsername || "Player",
                            profilePhotoUrl: c.challengedProfilePhotoUrl,
                            hasProfilePhoto: !!c.challengedProfilePhotoUrl,
                          }}
                          size="md"
                          showBadges={false}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-sm truncate">
                              {c.challengedName || c.challengedUsername || t("common.player")}
                            </p>
                            {c.createdAt && <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{timeAgo(c.createdAt)}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground capitalize">{c.gameType}</span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground capitalize">{c.format?.replace(/-/g, " ")}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                          <Clock size={10} /> {t("Waiting")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* My Game Join Requests */}
            {myGameRequests.length > 0 && (
              <section>
                <SectionHeader icon={Gamepad2} label={t("Game Requests Awaiting")} count={myGameRequests.length} color="text-muted-foreground" bg="bg-muted/20" />
                <div className="space-y-2.5">
                  {myGameRequests.map((r: any, i: number) => (
                    <div key={`my-game-${r.gameId}-${i}`} className="card p-4 rounded-2xl border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Gamepad2 size={22} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{r.gameName || "Game"}</p>
                          <p className="text-xs text-muted-foreground">{t("Awaiting organizer approval")}</p>
                          {r.scheduledAt && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/60">
                              <Calendar size={10} />
                              <span>{new Date(r.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                          <Clock size={10} /> {t("Pending")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* My Coaching Requests */}
            {myCoachingRequests.length > 0 && (
              <section>
                <SectionHeader icon={GraduationCap} label={t("Coaching Requests Awaiting")} count={myCoachingRequests.length} color="text-muted-foreground" bg="bg-muted/20" />
                <div className="space-y-2.5">
                  {myCoachingRequests.map((r: any, i: number) => (
                    <div key={`my-coach-${r.coachingId}-${i}`} className="card p-4 rounded-2xl border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                          <GraduationCap size={22} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{r.sessionTitle || t("Coaching Session")}</p>
                          <p className="text-xs text-muted-foreground">{t("Awaiting organizer approval")}</p>
                        </div>
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                          <Clock size={10} /> {t("Pending")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, count, color = "text-muted-foreground", bg = "bg-primary/15" }: { icon: any; label: string; count: number; color?: string; bg?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", bg)}>
        <Icon size={14} className={color} />
      </div>
      <h3 className="text-sm font-bold flex-1">{label}</h3>
      <span className="text-[10px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full">{count}</span>
    </div>
  );
}
