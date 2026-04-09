import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName } from "@/lib/avatarUtils";
import { cn } from "@/lib/utils";
import { ArrowLeft, Play, Trophy, Users, Plus, Minus, RotateCcw, CheckCircle, AlertTriangle, Clock, ChevronRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getSocket } from "@/lib/socket";

type Phase = "setup" | "playing" | "summary";

// Adapt participant (has userId) to AvatarUser (needs id)
const toAvatarUser = (p: any) => ({ ...p, id: p.userId });

const POINTS_TO_WIN_OPTIONS = [11, 15, 21];
const BEST_OF_OPTIONS = [1, 3, 5];

export default function GamePlayScreen() {
  const { t, i18n } = useTranslation();
  const { selectedGameId, goBack, user } = useApp();
  const [phase, setPhase] = useState<Phase>("setup");

  // Queries — disable refetchInterval while scoring to prevent overwriting local state
  const isScoringRef = useRef(false);
  const scoreboardQuery = trpc.games.scoreboard.useQuery(
    { gameId: selectedGameId! },
    { enabled: !!selectedGameId, refetchInterval: phase === "playing" && !isScoringRef.current ? 10000 : false }
  );
  const roundsQuery = trpc.games.getRounds.useQuery(
    { gameId: selectedGameId! },
    { enabled: !!selectedGameId }
  );

  // Mutations
  const startGameMutation = trpc.games.start.useMutation({
    onSuccess: () => { scoreboardQuery.refetch(); setPhase("playing"); },
    onError: (err) => toast.error(err.message),
  });
  const startWithTeamsMutation = trpc.games.startWithTeams.useMutation({
    onSuccess: () => { scoreboardQuery.refetch(); setPhase("playing"); },
    onError: (err) => toast.error(err.message),
  });
  const saveTeamsMutation = trpc.games.saveTeams.useMutation({
    onSuccess: () => scoreboardQuery.refetch(),
    onError: (err) => toast.error(err.message),
  });
  const saveRoundMutation = trpc.games.saveRound.useMutation({
    onSuccess: () => { isScoringRef.current = false; roundsQuery.refetch(); },
    onError: (err) => { isScoringRef.current = false; toast.error(err.message); },
  });
  const completeGameMutation = trpc.games.complete.useMutation({
    onSuccess: () => {
      setTimerRunning(false);
      toast.success(t("gamePlay.gameCompleted"));
      scoreboardQuery.refetch();
      roundsQuery.refetch();
      setPhase("summary");
    },
    onError: (err) => toast.error(err.message),
  });

  const scoreboard = scoreboardQuery.data;
  const game = scoreboard?.game;
  const participants = scoreboard?.participants ?? [];
  const result = scoreboard?.result;
  const rounds = roundsQuery.data ?? [];

  // Game settings state
  const [pointsToWin, setPointsToWin] = useState(11);
  const [bestOf, setBestOf] = useState(3);
  const [winBy, setWinBy] = useState(2);

  // Team assignment state
  const [team1Ids, setTeam1Ids] = useState<number[]>([]);
  const [team2Ids, setTeam2Ids] = useState<number[]>([]);

  // Scoring state
  const [currentRound, setCurrentRound] = useState(1);
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [servingTeam, setServingTeam] = useState<1 | 2>(1);

  // Scoring mode: "sideout" (traditional) or "rally" (every rally scores)
  const [scoringMode, setScoringMode] = useState<"rally" | "sideout">("rally");

  // Undo stack
  const undoStackRef = useRef<{ team1Score: number; team2Score: number; servingTeam: 1 | 2 }[]>([]);

  // Clear undo stack when game changes
  useEffect(() => {
    undoStackRef.current = [];
    setTeam1Score(0);
    setTeam2Score(0);
    setCurrentRound(1);
  }, [selectedGameId]);

  // Early start dialog
  const [showEarlyStartDialog, setShowEarlyStartDialog] = useState(false);

  // Timer — compute from server game start time if available
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Debounce ref for non-winning saves
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard against double-completion
  const completingRef = useRef(false);

  // Track whether timer has been started to avoid re-starting after round saves
  const timerStartedRef = useRef(false);

  // Initialize from existing data
  useEffect(() => {
    if (!scoreboard) return;
    if (game?.status === "in-progress") {
      setPhase("playing");
      if (result?.team1PlayerIds?.length) setTeam1Ids(result.team1PlayerIds);
      if (result?.team2PlayerIds?.length) setTeam2Ids(result.team2PlayerIds);
      // Restore game settings from server
      if (game.pointsToWin) setPointsToWin(game.pointsToWin);
      if (game.bestOf) setBestOf(game.bestOf);
      if (game.winBy) setWinBy(game.winBy);
      // Restore timer from server startedAt — only start once
      if (game.startedAt) {
        const elapsed = Math.floor((Date.now() - new Date(game.startedAt).getTime()) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));
        if (!timerStartedRef.current) {
          setTimerRunning(true);
          timerStartedRef.current = true;
        }
      }
      // Restore current round from saved rounds
      if (rounds.length > 0) {
        const lastRound = rounds[rounds.length - 1];
        if (lastRound.completedAt) {
          setCurrentRound(rounds.length + 1);
          setTeam1Score(0);
          setTeam2Score(0);
        } else {
          setCurrentRound(lastRound.roundNumber);
          setTeam1Score(lastRound.team1Score);
          setTeam2Score(lastRound.team2Score);
        }
      }
    } else if (game?.status === "completed") {
      setPhase("summary");
      setTimerRunning(false);
      timerStartedRef.current = false;
      if (result?.team1PlayerIds?.length) setTeam1Ids(result.team1PlayerIds);
      if (result?.team2PlayerIds?.length) setTeam2Ids(result.team2PlayerIds);
      // Restore game settings for display
      if (game.pointsToWin) setPointsToWin(game.pointsToWin);
      if (game.bestOf) setBestOf(game.bestOf);
      if (game.winBy) setWinBy(game.winBy);
      // Compute final elapsed from startedAt → completedAt
      if (game.startedAt) {
        const endTime = game.completedAt ? new Date(game.completedAt).getTime() : Date.now();
        const elapsed = Math.floor((endTime - new Date(game.startedAt).getTime()) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));
      }
    } else {
      // Setup phase - pre-fill teams from result if exists
      if (result?.team1PlayerIds?.length) setTeam1Ids(result.team1PlayerIds);
      if (result?.team2PlayerIds?.length) setTeam2Ids(result.team2PlayerIds);
    }
  }, [scoreboard?.game?.status, scoreboard?.game?.startedAt, rounds.length]);

  // Timer effect
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // ── Socket: join game room + listen for real-time score updates ──────
  useEffect(() => {
    if (!selectedGameId || phase !== "playing") return;
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit("game:join", selectedGameId);

    const handleScoreUpdate = (data: { gameId: number; team1Score: number; team2Score: number; currentRound: number; servingTeam: 1 | 2; updatedBy: number }) => {
      if (data.gameId !== selectedGameId) return;
      if (data.updatedBy === user?.id) return; // Ignore own updates
      if (isScoringRef.current) return; // Don't overwrite if user is actively scoring
      setTeam1Score(data.team1Score);
      setTeam2Score(data.team2Score);
      setCurrentRound(data.currentRound);
      setServingTeam(data.servingTeam);
    };

    const handleGameUpdated = (data: any) => {
      if (data.gameId !== selectedGameId) return;
      // Refetch scoreboard + rounds when game state changes
      scoreboardQuery.refetch();
      roundsQuery.refetch();
    };

    const handleRoundComplete = (data: { gameId: number; roundNumber: number; team1Score: number; team2Score: number; winnerTeam: string }) => {
      if (data.gameId !== selectedGameId) return;
      // Another player saved a completed round — refetch rounds and advance
      roundsQuery.refetch();
      scoreboardQuery.refetch();
      // If we're not the one who scored, advance to next round
      if (!isScoringRef.current) {
        setCurrentRound(data.roundNumber + 1);
        setTeam1Score(0);
        setTeam2Score(0);
      }
    };

    const handleGameCompleted = (data: { gameId: number }) => {
      if (data.gameId !== selectedGameId) return;
      // Game was completed by another player — refetch and go to summary
      scoreboardQuery.refetch();
      roundsQuery.refetch();
      setTimerRunning(false);
      setPhase("summary");
    };

    socket.on("game:scoreUpdate", handleScoreUpdate);
    socket.on("game:updated", handleGameUpdated);
    socket.on("game:roundComplete", handleRoundComplete);
    socket.on("game:completed", handleGameCompleted);

    return () => {
      socket.off("game:scoreUpdate", handleScoreUpdate);
      socket.off("game:updated", handleGameUpdated);
      socket.off("game:roundComplete", handleRoundComplete);
      socket.off("game:completed", handleGameCompleted);
    };
  }, [selectedGameId, phase, user?.id]);

  // Derived data
  const unassignedPlayers = participants.filter(
    p => !team1Ids.includes(p.userId) && !team2Ids.includes(p.userId)
  );
  const team1Players = participants.filter(p => team1Ids.includes(p.userId));
  const team2Players = participants.filter(p => team2Ids.includes(p.userId));
  const isOrganizer = game?.organizerId === user?.id;
  const isParticipant = participants.some(p => p.userId === user?.id);
  const canScore = isOrganizer || isParticipant;

  // Round wins calculation
  const team1RoundWins = rounds.filter(r => r.winnerTeam === "team1").length;
  const team2RoundWins = rounds.filter(r => r.winnerTeam === "team2").length;
  const roundsToWin = Math.ceil(bestOf / 2);

  // Check if current round is a game/match point
  const isGamePoint = useMemo(() => {
    if (team1Score >= pointsToWin - 1 && team1Score >= team2Score + winBy - 1) return 1;
    if (team2Score >= pointsToWin - 1 && team2Score >= team1Score + winBy - 1) return 2;
    return 0;
  }, [team1Score, team2Score, pointsToWin, winBy]);

  const isMatchPoint = useMemo(() => {
    if (isGamePoint === 1 && team1RoundWins === roundsToWin - 1) return 1;
    if (isGamePoint === 2 && team2RoundWins === roundsToWin - 1) return 2;
    return 0;
  }, [isGamePoint, team1RoundWins, team2RoundWins, roundsToWin]);

  // Check round winner after each score update
  const checkRoundWinner = useCallback((t1: number, t2: number) => {
    if (t1 >= pointsToWin && t1 - t2 >= winBy) return "team1" as const;
    if (t2 >= pointsToWin && t2 - t1 >= winBy) return "team2" as const;
    return null;
  }, [pointsToWin, winBy]);

  const handleTogglePlayer = (playerId: number) => {
    if (team1Ids.includes(playerId)) {
      setTeam1Ids(prev => prev.filter(id => id !== playerId));
      setTeam2Ids(prev => [...prev, playerId]);
    } else if (team2Ids.includes(playerId)) {
      setTeam2Ids(prev => prev.filter(id => id !== playerId));
    } else {
      // Auto-balance: if team1 is full or bigger, add to team2
      const maxPerTeam = game?.format === "singles" ? 1 : Math.ceil((game?.maxPlayers ?? 4) / 2);
      if (team1Ids.length < maxPerTeam) {
        setTeam1Ids(prev => [...prev, playerId]);
      } else {
        setTeam2Ids(prev => [...prev, playerId]);
      }
    }
  };

  const handleStartGame = () => {
    if (!selectedGameId || (!isOrganizer && !isParticipant)) return;
    if (team1Ids.length === 0 || team2Ids.length === 0) {
      toast.error(t("gamePlay.bothTeamsNeeded", "Both teams need at least one player"));
      return;
    }

    // Check if starting early
    const scheduledAt = game?.scheduledAt ? new Date(game.scheduledAt) : null;
    const now = new Date();
    if (scheduledAt && scheduledAt > now) {
      setShowEarlyStartDialog(true);
      return;
    }

    doStartGame();
  };

  const doStartGame = () => {
    if (!selectedGameId) return;
    setShowEarlyStartDialog(false);
    // Atomic: save teams + start game + game settings in one transaction
    startWithTeamsMutation.mutate({
      gameId: selectedGameId,
      team1PlayerIds: team1Ids,
      team2PlayerIds: team2Ids,
      pointsToWin,
      bestOf,
      winBy,
    });
    setTimerRunning(true);
  };

  const handleScoreChange = (team: 1 | 2, delta: number) => {
    if (!canScore) return;
    if (completingRef.current) return;
    isScoringRef.current = true;

    // Push undo state before modifying
    undoStackRef.current.push({ team1Score, team2Score, servingTeam });

    const newT1 = team === 1 ? Math.max(0, team1Score + delta) : team1Score;
    const newT2 = team === 2 ? Math.max(0, team2Score + delta) : team2Score;
    setTeam1Score(newT1);
    setTeam2Score(newT2);

    // Switch serving team on side-out (scoring team change)
    const newServing = delta > 0 ? team : servingTeam;
    if (delta > 0) {
      setServingTeam(team);
    }

    // Broadcast score update via socket for real-time sync
    if (selectedGameId) {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit("game:scoreUpdate", {
          gameId: selectedGameId,
          team1Score: newT1,
          team2Score: newT2,
          currentRound,
          servingTeam: newServing,
          updatedBy: user?.id,
        });
      }
    }

    // Check for round winner
    const winner = checkRoundWinner(newT1, newT2);
    if (winner && selectedGameId) {
      // Clear any pending debounced save
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveRoundMutation.mutate({
        gameId: selectedGameId,
        roundNumber: currentRound,
        team1Score: newT1,
        team2Score: newT2,
        winnerTeam: winner,
        completed: true,
      }, {
        onSuccess: () => {
          isScoringRef.current = false;
          const newWins = winner === "team1" ? team1RoundWins + 1 : team2RoundWins + 1;
          if (newWins >= roundsToWin && !completingRef.current) {
            // Match is over
            completingRef.current = true;
            undoStackRef.current = [];
            // Only sum previously completed rounds (exclude current round's intermediate saves)
            const priorRounds = rounds.filter(r => r.roundNumber < currentRound);
            const totalT1 = priorRounds.reduce((sum, r) => sum + r.team1Score, 0) + newT1;
            const totalT2 = priorRounds.reduce((sum, r) => sum + r.team2Score, 0) + newT2;
            const { t1, t2 } = getResolvedTeamIds();
            completeGameMutation.mutate({
              gameId: selectedGameId,
              team1Score: totalT1,
              team2Score: totalT2,
              team1PlayerIds: t1,
              team2PlayerIds: t2,
            });
            setTimerRunning(false);
          } else {
            // Next round — clear undo stack (cannot undo across rounds)
            undoStackRef.current = [];
            toast.success(`${t("gamePlay.round", { number: currentRound })} — ${winner === "team1" ? t("gamePlay.team1") : t("gamePlay.team2")} wins!`);
            setCurrentRound(prev => prev + 1);
            setTeam1Score(0);
            setTeam2Score(0);
            setServingTeam(winner === "team1" ? 1 : 2);
          }
        },
      });
    } else if (selectedGameId) {
      // Debounce non-winning score saves (2 seconds)
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        saveRoundMutation.mutate({
          gameId: selectedGameId,
          roundNumber: currentRound,
          team1Score: newT1,
          team2Score: newT2,
          completed: false,
        }, {
          onSettled: () => { isScoringRef.current = false; },
        });
      }, 2000);
    }
  };

  // Derive team IDs from participants when team arrays are empty (fallback)
  const getResolvedTeamIds = () => {
    let t1 = team1Ids;
    let t2 = team2Ids;
    if (t1.length === 0 || t2.length === 0) {
      // Split participants evenly as fallback
      const pIds = participants.map(p => p.userId);
      const half = Math.ceil(pIds.length / 2);
      t1 = t1.length > 0 ? t1 : pIds.slice(0, half);
      t2 = t2.length > 0 ? t2 : pIds.slice(half);
    }
    return { t1, t2 };
  };

  const handleManualComplete = () => {
    if (!selectedGameId) return;
    const roundWinner = team1Score > team2Score ? "team1" as const : team2Score > team1Score ? "team2" as const : undefined;
    // Save current round first
    saveRoundMutation.mutate({
      gameId: selectedGameId,
      roundNumber: currentRound,
      team1Score,
      team2Score,
      winnerTeam: roundWinner,
      completed: true,
    }, {
      onSuccess: () => {
        // Use only prior rounds (not the current one which was just saved via saveRoundMutation)
        const priorRounds = rounds.filter(r => r.roundNumber < currentRound);
        const totalT1 = priorRounds.reduce((sum, r) => sum + r.team1Score, 0) + team1Score;
        const totalT2 = priorRounds.reduce((sum, r) => sum + r.team2Score, 0) + team2Score;
        const { t1, t2 } = getResolvedTeamIds();
        completeGameMutation.mutate({
          gameId: selectedGameId,
          team1Score: totalT1,
          team2Score: totalT2,
          team1PlayerIds: t1,
          team2PlayerIds: t2,
        });
        setTimerRunning(false);
      },
    });
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleUndo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    setTeam1Score(prev.team1Score);
    setTeam2Score(prev.team2Score);
    setServingTeam(prev.servingTeam);
  };

  if (!selectedGameId) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("gamePlay.noGameSelected")}</p>
      </div>
    );
  }

  if (scoreboardQuery.isLoading) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-secondary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (scoreboardQuery.isError) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center flex-col gap-3">
        <AlertTriangle size={32} className="text-destructive" />
        <p className="text-sm text-destructive">{t("gamePlay.loadError")}</p>
        <Button variant="outline" onClick={() => scoreboardQuery.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SETUP PHASE — team assignment + game settings
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === "setup") {
    return (
      <div className="pb-24 min-h-screen">
        {/* Header */}
        <div className="px-4 pt-6 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} aria-label="Go back" className="p-1 rounded-full hover:bg-muted/20">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">{t("gamePlay.teamSetup")}</h1>
        </div>

        {/* Game Info */}
        {game && (
          <div className="px-4 mb-4">
            <div className="card-elevated rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">{game.locationName || t("common.tbd")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t(`gameTypes.${game.gameType}`)} — {t(`gameFormats.${game.format}`)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(game.scheduledAt).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(game.scheduledAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Settings */}
        <div className="px-4 mb-4">
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">{t("gamePlay.pointsToWin")}</h3>
            <div className="flex gap-2 mb-3">
              {POINTS_TO_WIN_OPTIONS.map(pts => (
                <button
                  key={pts}
                  onClick={() => setPointsToWin(pts)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    pointsToWin === pts
                      ? "border-secondary bg-secondary/20 text-secondary"
                      : "border-border bg-background/30 text-muted-foreground"
                  )}
                >
                  {pts}
                </button>
              ))}
            </div>

            <h3 className="text-sm font-semibold mb-3">{t("gamePlay.bestOf")}</h3>
            <div className="flex gap-2 mb-3">
              {BEST_OF_OPTIONS.map(bo => (
                <button
                  key={bo}
                  onClick={() => setBestOf(bo)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    bestOf === bo
                      ? "border-secondary bg-secondary/20 text-secondary"
                      : "border-border bg-background/30 text-muted-foreground"
                  )}
                >
                  {bo}
                </button>
              ))}
            </div>

            <h3 className="text-sm font-semibold mb-3">{t("gamePlay.winBy")}</h3>
            <div className="flex gap-2 mb-3">
              {[1, 2].map(wb => (
                <button
                  key={wb}
                  onClick={() => setWinBy(wb)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    winBy === wb
                      ? "border-secondary bg-secondary/20 text-secondary"
                      : "border-border bg-background/30 text-muted-foreground"
                  )}
                >
                  {wb}
                </button>
              ))}
            </div>

            <h3 className="text-sm font-semibold mb-3">{t("gamePlay.scoringMode")}</h3>
            <div className="flex gap-2">
              {(["rally", "sideout"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setScoringMode(mode)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    scoringMode === mode
                      ? "border-secondary bg-secondary/20 text-secondary"
                      : "border-border bg-background/30 text-muted-foreground"
                  )}
                >
                  {t(`gamePlay.${mode}Scoring`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Team Assignment */}
        <div className="px-4 mb-4">
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">{t("gamePlay.assignTeams")}</h3>
            <p className="text-[10px] text-muted-foreground mb-3">{t("gamePlay.dragToAssign")}</p>

            {/* Unassigned */}
            {unassignedPlayers.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-muted-foreground font-semibold mb-2 uppercase tracking-wide">{t("common.players")}</p>
                <div className="flex flex-wrap gap-2">
                  {unassignedPlayers.map(p => (
                    <button
                      key={p.userId}
                      onClick={() => handleTogglePlayer(p.userId)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background/30 hover:bg-muted/20 transition-all"
                    >
                      <PlayerAvatar user={toAvatarUser(p)} size="sm" showBadges={false} />
                      <span className="text-xs font-medium">{getDisplayName(toAvatarUser(p))}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Team 1 */}
            <div className="mb-3">
              <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-primary" /> {t("gamePlay.team1")}
              </p>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg border border-primary/20 bg-primary/5">
                {team1Players.length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic">{t("gamePlay.dragToAssign")}</p>
                )}
                {team1Players.map(p => (
                  <button
                    key={p.userId}
                    onClick={() => handleTogglePlayer(p.userId)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 transition-all hover:bg-primary/25"
                  >
                    <PlayerAvatar user={toAvatarUser(p)} size="sm" showBadges={false} />
                    <span className="text-xs font-medium">{getDisplayName(toAvatarUser(p))}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Team 2 */}
            <div>
              <p className="text-xs font-bold text-secondary mb-2 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-secondary" /> {t("gamePlay.team2")}
              </p>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg border border-secondary/20 bg-secondary/5">
                {team2Players.length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic">{t("gamePlay.dragToAssign")}</p>
                )}
                {team2Players.map(p => (
                  <button
                    key={p.userId}
                    onClick={() => handleTogglePlayer(p.userId)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/15 border border-secondary/30 transition-all hover:bg-secondary/25"
                  >
                    <PlayerAvatar user={toAvatarUser(p)} size="sm" showBadges={false} />
                    <span className="text-xs font-medium">{getDisplayName(toAvatarUser(p))}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        {(isOrganizer || isParticipant) && (
          <div className="px-4">
            <Button
              onClick={handleStartGame}
              disabled={team1Ids.length === 0 || team2Ids.length === 0 || startWithTeamsMutation.isPending}
              className="w-full bg-gradient-to-r from-primary to-secondary font-bold text-base py-6"
            >
              <Play size={20} className="mr-2" />
              {startWithTeamsMutation.isPending ? t("common.loading") : t("gamePlay.startGame")}
            </Button>
          </div>
        )}

        {/* Early Start Dialog */}
        {showEarlyStartDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
            <div className="card-elevated rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-400" />
                </div>
                <h3 className="text-base font-bold">{t("gamePlay.startEarlyTitle")}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                {t("gamePlay.startEarlyDesc", {
                  time: game?.scheduledAt ? new Date(game.scheduledAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" }) : "",
                })}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowEarlyStartDialog(false)} className="flex-1">
                  {t("common.cancel")}
                </Button>
                <Button onClick={doStartGame} className="flex-1 bg-gradient-to-r from-primary to-secondary font-bold">
                  {t("gamePlay.startNow")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PLAYING PHASE — live score tracking
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === "playing") {
    return (
      <div className="pb-24 min-h-screen">
        {/* Header */}
        <div className="px-4 pt-6 pb-2 flex items-center justify-between">
          <button onClick={() => goBack()} aria-label="Go back" className="p-1 rounded-full hover:bg-muted/20">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-[10px] text-secondary font-semibold uppercase tracking-wider">{t("gamePlay.gameInProgress")}</p>
            <p className="text-sm font-bold">{t("gamePlay.round", { number: currentRound })}</p>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock size={14} />
            <span className="text-xs font-mono">{formatTimer(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Match Score Bar - round wins */}
        {bestOf > 1 && (
          <div className="px-4 mb-3">
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="flex gap-1">
                {Array.from({ length: roundsToWin }).map((_, i) => (
                  <div key={i} className={cn("w-3 h-3 rounded-full transition-all",
                    i < team1RoundWins ? "bg-primary" : "bg-muted/30"
                  )} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {team1RoundWins} — {team2RoundWins}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: roundsToWin }).map((_, i) => (
                  <div key={i} className={cn("w-3 h-3 rounded-full transition-all",
                    i < team2RoundWins ? "bg-secondary" : "bg-muted/30"
                  )} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game/Match Point indicator */}
        {(isMatchPoint > 0 || isGamePoint > 0) && (
          <div className="px-4 mb-3">
            <div className={cn(
              "text-center py-2 rounded-xl text-xs font-bold animate-pulse",
              isMatchPoint > 0 ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
            )}>
              {isMatchPoint > 0 ? t("gamePlay.matchPoint") : t("gamePlay.gamePoint")}
            </div>
          </div>
        )}

        {/* Score Cards */}
        <div className="px-4 grid grid-cols-2 gap-3 mb-4">
          {/* Team 1 */}
          <div className={cn(
            "card-elevated rounded-xl p-4 text-center transition-all",
            servingTeam === 1 && "ring-2 ring-primary/50"
          )}>
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
              <p className="text-xs font-bold text-primary">{t("gamePlay.team1")}</p>
              {servingTeam === 1 && (
                <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-semibold ml-1">
                  {t("gamePlay.serve")}
                </span>
              )}
            </div>

            {/* Team Players */}
            <div className="flex justify-center gap-1 mb-3">
              {team1Players.map(p => (
                <PlayerAvatar key={p.userId} user={toAvatarUser(p)} size="sm" showBadges={false} />
              ))}
            </div>

            {/* Score */}
            <p className="text-5xl font-black stat-number text-primary mb-3">{team1Score}</p>

            {/* Controls */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleScoreChange(1, -1)}
                disabled={team1Score <= 0 || saveRoundMutation.isPending || !canScore}
                className="w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center hover:bg-muted/30 disabled:opacity-30 transition-all active:scale-90"
              >
                <Minus size={16} />
              </button>
              <button
                onClick={() => handleScoreChange(1, 1)}
                disabled={saveRoundMutation.isPending || !canScore || (scoringMode === "sideout" && servingTeam !== 1)}
                className="w-14 h-10 rounded-xl bg-primary/20 text-primary font-bold text-sm flex items-center justify-center hover:bg-primary/30 transition-all active:scale-90 disabled:opacity-30"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Team 2 */}
          <div className={cn(
            "card-elevated rounded-xl p-4 text-center transition-all",
            servingTeam === 2 && "ring-2 ring-secondary/50"
          )}>
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-secondary" />
              <p className="text-xs font-bold text-secondary">{t("gamePlay.team2")}</p>
              {servingTeam === 2 && (
                <span className="text-[8px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded-full font-semibold ml-1">
                  {t("gamePlay.serve")}
                </span>
              )}
            </div>

            {/* Team Players */}
            <div className="flex justify-center gap-1 mb-3">
              {team2Players.map(p => (
                <PlayerAvatar key={p.userId} user={toAvatarUser(p)} size="sm" showBadges={false} />
              ))}
            </div>

            {/* Score */}
            <p className="text-5xl font-black stat-number text-secondary mb-3">{team2Score}</p>

            {/* Controls */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleScoreChange(2, -1)}
                disabled={team2Score <= 0 || saveRoundMutation.isPending || !canScore}
                className="w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center hover:bg-muted/30 disabled:opacity-30 transition-all active:scale-90"
              >
                <Minus size={16} />
              </button>
              <button
                onClick={() => handleScoreChange(2, 1)}
                disabled={saveRoundMutation.isPending || !canScore || (scoringMode === "sideout" && servingTeam !== 2)}
                className="w-14 h-10 rounded-xl bg-secondary/20 text-secondary font-bold text-sm flex items-center justify-center hover:bg-secondary/30 transition-all active:scale-90 disabled:opacity-30"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Undo + Serving Toggle */}
        <div className="px-4 mb-4 flex gap-2">
          <button
            onClick={handleUndo}
            disabled={undoStackRef.current.length === 0}
            className="flex-1 card-elevated rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
          >
            <Undo2 size={14} />
            {t("gamePlay.undo")}
          </button>
          <button
            onClick={() => setServingTeam(s => s === 1 ? 2 : 1)}
            className="flex-1 card-elevated rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-all"
          >
            <RotateCcw size={14} />
            {t("gamePlay.sideOut")}
          </button>
        </div>

        {/* Round History */}
        {rounds.filter(r => r.completedAt).length > 0 && (
          <div className="px-4 mb-4">
            <div className="card-elevated rounded-xl p-3">
              <h3 className="text-xs font-bold mb-2">{t("gamePlay.rounds")}</h3>
              <div className="space-y-1.5">
                {rounds.filter(r => r.completedAt).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("gamePlay.round", { number: r.roundNumber })}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-bold", r.winnerTeam === "team1" ? "text-primary" : "text-muted-foreground")}>
                        {r.team1Score}
                      </span>
                      <span className="text-muted-foreground">-</span>
                      <span className={cn("font-bold", r.winnerTeam === "team2" ? "text-secondary" : "text-muted-foreground")}>
                        {r.team2Score}
                      </span>
                      {r.winnerTeam && (
                        <CheckCircle size={12} className={r.winnerTeam === "team1" ? "text-primary" : "text-secondary"} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Complete Game Button */}
        {(isOrganizer || isParticipant) && (
          <div className="px-4">
            <Button
              onClick={() => {
                if (window.confirm(t("gamePlay.completeGameDesc"))) {
                  handleManualComplete();
                }
              }}
              disabled={completeGameMutation.isPending}
              variant="outline"
              className="w-full border-secondary/30 text-secondary hover:bg-secondary/10"
            >
              <Trophy size={16} className="mr-2" />
              {completeGameMutation.isPending ? t("common.loading") : t("gamePlay.completeGame")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY PHASE — game over, results
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="pb-24 min-h-screen">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => goBack()} aria-label="Go back" className="p-1 rounded-full hover:bg-muted/20">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">{t("gamePlay.gameSummary")}</h1>
      </div>

      {/* Game Over Banner */}
      <div className="px-4 mb-4">
        <div className="card-hero rounded-xl p-6 text-center">
          <div className="relative z-10">
            <Trophy size={40} className="text-secondary mx-auto mb-3" />
            <h2 className="text-xl font-black mb-2">{t("gamePlay.gameOver")}</h2>
            {result && (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {result.winnerTeam === "team1"
                    ? t("gamePlay.winsMatch", { team: t("gamePlay.team1") })
                    : result.winnerTeam === "team2"
                    ? t("gamePlay.winsMatch", { team: t("gamePlay.team2") })
                    : t("gamePlay.draw")}
                </p>

                {/* Final Score */}
                <div className="flex items-center justify-center gap-6 mb-4">
                  <div className="text-center">
                    <p className="text-xs font-semibold text-primary mb-1">{t("gamePlay.team1")}</p>
                    <div className="flex justify-center gap-1 mb-2">
                      {team1Players.map(p => (
                        <PlayerAvatar key={p.userId} user={toAvatarUser(p)} size="sm" showBadges={false} />
                      ))}
                    </div>
                    <p className={cn(
                      "text-3xl font-black stat-number",
                      result.winnerTeam === "team1" ? "text-primary" : "text-muted-foreground"
                    )}>
                      {result.team1Score}
                    </p>
                  </div>

                  <span className="text-lg font-bold text-muted-foreground">{t("gamePlay.vs")}</span>

                  <div className="text-center">
                    <p className="text-xs font-semibold text-secondary mb-1">{t("gamePlay.team2")}</p>
                    <div className="flex justify-center gap-1 mb-2">
                      {team2Players.map(p => (
                        <PlayerAvatar key={p.userId} user={toAvatarUser(p)} size="sm" showBadges={false} />
                      ))}
                    </div>
                    <p className={cn(
                      "text-3xl font-black stat-number",
                      result.winnerTeam === "team2" ? "text-secondary" : "text-muted-foreground"
                    )}>
                      {result.team2Score}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Round Breakdown */}
      {rounds.length > 0 && (
        <div className="px-4 mb-4">
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
                <Trophy size={12} className="text-secondary" />
              </div>
              {t("gamePlay.rounds")}
            </h3>
            <div className="space-y-2">
              {rounds.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10">
                  <span className="text-xs font-medium">{t("gamePlay.round", { number: r.roundNumber })}</span>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-sm font-bold",
                      r.winnerTeam === "team1" ? "text-primary" : "text-muted-foreground"
                    )}>
                      {r.team1Score}
                    </span>
                    <span className="text-muted-foreground text-xs">-</span>
                    <span className={cn(
                      "text-sm font-bold",
                      r.winnerTeam === "team2" ? "text-secondary" : "text-muted-foreground"
                    )}>
                      {r.team2Score}
                    </span>
                    {r.winnerTeam && (
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center",
                        r.winnerTeam === "team1" ? "bg-primary/20" : "bg-secondary/20"
                      )}>
                        <CheckCircle size={12} className={r.winnerTeam === "team1" ? "text-primary" : "text-secondary"} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 mb-4">
        <div className="card-elevated rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">{t("gamePlay.gameSummary")}</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-black stat-number">{formatTimer(elapsedSeconds)}</p>
              <p className="text-[10px] text-muted-foreground">{t("gamePlay.duration")}</p>
            </div>
            <div>
              <p className="text-lg font-black stat-number">
                {result ? result.team1Score + result.team2Score : 0}
              </p>
              <p className="text-[10px] text-muted-foreground">{t("gamePlay.totalPoints")}</p>
            </div>
            <div>
              <p className="text-lg font-black stat-number">{rounds.length}</p>
              <p className="text-[10px] text-muted-foreground">{t("gamePlay.roundsPlayed")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Back to History */}
      <div className="px-4">
        <Button
          onClick={() => goBack()}
          className="w-full bg-gradient-to-r from-primary to-secondary font-bold"
        >
          {t("common.back")}
        </Button>
      </div>
    </div>
  );
}
