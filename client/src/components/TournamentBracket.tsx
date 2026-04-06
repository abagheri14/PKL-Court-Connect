import { Button } from "@/components/ui/button";
import { Play, Trophy, ChevronRight, Loader2, Eye, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useRef, useEffect } from "react";

interface BracketProps {
  bracket: {
    rounds: Record<number, any[]>;
    participantMap: Record<number, { userId: number; name: string; seed: number | null }>;
  };
  tournament: any;
  isOrganizer: boolean;
  onStartMatch: (matchId: number) => void;
  onReportResult: (matchId: number, winnerId: number) => void;
  onViewGame: (gameId: number) => void;
  startMatchPending: boolean;
  reportResultPending: boolean;
}

export default function TournamentBracket({
  bracket,
  tournament,
  isOrganizer,
  onStartMatch,
  onReportResult,
  onViewGame,
  startMatchPending,
  reportResultPending,
}: BracketProps) {
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rounds = bracket.rounds;
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  const isRoundRobin = tournament.format === "round-robin";

  if (isRoundRobin) {
    return (
      <RoundRobinView
        bracket={bracket}
        tournament={tournament}
        isOrganizer={isOrganizer}
        onStartMatch={onStartMatch}
        onReportResult={onReportResult}
        onViewGame={onViewGame}
        startMatchPending={startMatchPending}
        reportResultPending={reportResultPending}
      />
    );
  }

  // Check if this is the final round (for elimination)
  const winnersRoundCount = Math.ceil(Math.log2(tournament.maxParticipants));

  const getRoundLabel = (roundNum: number) => {
    if (roundNum === roundNumbers[roundNumbers.length - 1]) return "Finals";
    if (roundNum === roundNumbers[roundNumbers.length - 2]) return "Semi-Finals";
    if (roundNum === roundNumbers[roundNumbers.length - 3] && roundNumbers.length > 3) return "Quarter-Finals";
    return `Round ${roundNum}`;
  };

  return (
    <div className="space-y-4">
      {/* Round navigation pills */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {roundNumbers.map(roundNum => {
          const matches = rounds[roundNum] || [];
          const allDone = matches.every((m: any) => m.status === "completed");
          const hasCurrent = matches.some((m: any) => m.status === "in-progress" || m.status === "ready");
          return (
            <button
              key={roundNum}
              onClick={() => {
                const el = document.getElementById(`round-${roundNum}`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
                hasCurrent ? "border-primary bg-primary/10 text-primary" :
                allDone ? "border-green-500/30 bg-green-500/10 text-green-400" :
                "border-border bg-muted text-muted-foreground"
              )}
            >
              {getRoundLabel(roundNum)}
            </button>
          );
        })}
      </div>

      {/* Bracket visualization */}
      <div ref={scrollRef} className="overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {roundNumbers.map(roundNum => {
            const matches = rounds[roundNum] || [];
            return (
              <div key={roundNum} id={`round-${roundNum}`} className="flex flex-col gap-3 min-w-[220px]">
                <h3 className="text-xs font-semibold text-muted-foreground text-center sticky top-0 bg-background py-1">
                  {getRoundLabel(roundNum)}
                </h3>
                {matches.map((match: any) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    isOrganizer={isOrganizer}
                    isSelected={selectedMatch === match.id}
                    onSelect={() => setSelectedMatch(selectedMatch === match.id ? null : match.id)}
                    onStartMatch={() => onStartMatch(match.id)}
                    onReportResult={(winnerId) => onReportResult(match.id, winnerId)}
                    onViewGame={() => match.gameId && onViewGame(match.gameId)}
                    startMatchPending={startMatchPending}
                    reportResultPending={reportResultPending}
                    isFinal={roundNum === roundNumbers[roundNumbers.length - 1]}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  isOrganizer,
  isSelected,
  onSelect,
  onStartMatch,
  onReportResult,
  onViewGame,
  startMatchPending,
  reportResultPending,
  isFinal,
}: {
  match: any;
  isOrganizer: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onStartMatch: () => void;
  onReportResult: (winnerId: number) => void;
  onViewGame: () => void;
  startMatchPending: boolean;
  reportResultPending: boolean;
  isFinal: boolean;
}) {
  const getSlotStyle = (participantId: number | null, isWinner: boolean) => {
    if (isWinner) return "bg-green-500/10 border-green-500/30 text-green-400";
    if (match.status === "completed" && !isWinner && participantId) return "bg-red-500/5 border-red-500/20 text-red-400/60";
    return "bg-card border-border";
  };

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      match.isBye ? "border-border/50 opacity-60" :
      match.status === "completed" ? "border-green-500/20" :
      match.status === "in-progress" ? "border-[#FFC107]/30 shadow-[#FFC107]/5 shadow-lg" :
      match.status === "ready" ? "border-primary/30" :
      "border-border",
      isFinal && match.status === "completed" && "ring-2 ring-[#FFC107]/30"
    )}>
      {/* Player slots */}
      <div className="divide-y divide-border">
        <ParticipantSlot
          participant={match.participant1}
          isWinner={match.winnerId === match.participant1Id}
          isCompleted={match.status === "completed"}
          seed={match.participant1?.seed}
          isBye={match.isBye && !match.participant1}
          isFinalWinner={isFinal && match.winnerId === match.participant1Id}
        />
        <ParticipantSlot
          participant={match.participant2}
          isWinner={match.winnerId === match.participant2Id}
          isCompleted={match.status === "completed"}
          seed={match.participant2?.seed}
          isBye={match.isBye && !match.participant2}
          isFinalWinner={isFinal && match.winnerId === match.participant2Id}
        />
      </div>

      {/* Match status & actions */}
      {!match.isBye && (
        <div className="px-2 py-1.5 border-t border-border">
          {match.status === "ready" && isOrganizer && (
            <Button
              size="sm"
              onClick={onStartMatch}
              disabled={startMatchPending}
              className="w-full h-7 text-xs gap-1"
            >
              {startMatchPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Start Match
            </Button>
          )}
          {match.status === "in-progress" && (
            <div className="space-y-1">
              {match.gameId && (
                <Button size="sm" variant="outline" onClick={onViewGame} className="w-full h-7 text-xs gap-1">
                  <Eye className="w-3 h-3" /> View Live Game
                </Button>
              )}
              {isOrganizer && match.participant1 && match.participant2 && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReportResult(match.participant1Id)}
                    disabled={reportResultPending}
                    className="flex-1 h-7 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10"
                  >
                    {match.participant1.name} wins
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReportResult(match.participant2Id)}
                    disabled={reportResultPending}
                    className="flex-1 h-7 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10"
                  >
                    {match.participant2.name} wins
                  </Button>
                </div>
              )}
            </div>
          )}
          {match.status === "completed" && match.gameId && (
            <Button size="sm" variant="ghost" onClick={onViewGame} className="w-full h-7 text-xs gap-1 text-muted-foreground">
              <Eye className="w-3 h-3" /> View Game
            </Button>
          )}
          {match.status === "pending" && (
            <p className="text-[10px] text-center text-muted-foreground">Waiting for previous round</p>
          )}
        </div>
      )}
    </div>
  );
}

function ParticipantSlot({
  participant,
  isWinner,
  isCompleted,
  seed,
  isBye,
  isFinalWinner,
}: {
  participant: { userId: number; name: string; seed: number | null } | null;
  isWinner: boolean;
  isCompleted: boolean;
  seed?: number | null;
  isBye: boolean;
  isFinalWinner?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
      isWinner && isCompleted ? "bg-green-500/10" : "",
      !isWinner && isCompleted && participant ? "opacity-50" : "",
    )}>
      {seed && (
        <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">{seed}</span>
      )}
      {isFinalWinner && <Crown className="w-3.5 h-3.5 text-[#FFC107] flex-shrink-0" />}
      <span className={cn(
        "truncate flex-1 text-xs",
        participant ? "font-medium" : "text-muted-foreground italic"
      )}>
        {participant ? participant.name : isBye ? "BYE" : "TBD"}
      </span>
      {isWinner && <Trophy className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
    </div>
  );
}

// Round-Robin specific view
function RoundRobinView({
  bracket,
  tournament,
  isOrganizer,
  onStartMatch,
  onReportResult,
  onViewGame,
  startMatchPending,
  reportResultPending,
}: BracketProps) {
  const rounds = bracket.rounds;
  const allMatches = Object.values(rounds).flat();

  // Build standings from participants
  const participants = Object.values(bracket.participantMap);
  const standingsMap = new Map<number, { id: number; name: string; wins: number; losses: number; points: number }>();
  for (const p of participants) {
    standingsMap.set(p.userId, { id: p.userId, name: p.name, wins: 0, losses: 0, points: 0 });
  }

  // Tally results from completed matches
  for (const match of allMatches) {
    if (match.status !== "completed" || !match.winnerId || !match.winner) continue;
    const winner = standingsMap.get(match.winner.userId);
    if (winner) { winner.wins++; winner.points += 3; }

    const loserId = match.winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;
    const loser = loserId ? bracket.participantMap[loserId] : null;
    if (loser) {
      const ls = standingsMap.get(loser.userId);
      if (ls) ls.losses++;
    }
  }

  const standings = Array.from(standingsMap.values()).sort((a, b) => b.points - a.points || b.wins - a.wins);

  return (
    <div className="space-y-6">
      {/* Standings */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-sm font-semibold">Standings</h3>
        </div>
        <div className="divide-y divide-border">
          {standings.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className={cn(
                "w-5 text-center font-bold text-xs",
                idx === 0 ? "text-[#FFC107]" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground"
              )}>
                {idx + 1}
              </span>
              <span className="flex-1 font-medium text-xs">{s.name}</span>
              <span className="text-xs text-green-400">{s.wins}W</span>
              <span className="text-xs text-red-400">{s.losses}L</span>
              <span className="text-xs font-bold w-8 text-right">{s.points}pt</span>
            </div>
          ))}
        </div>
      </div>

      {/* Matches list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Matches</h3>
        {allMatches.map((match: any) => (
          <div key={match.id} className={cn(
            "bg-card border rounded-xl p-3",
            match.status === "in-progress" ? "border-[#FFC107]/30" :
            match.status === "completed" ? "border-green-500/20" :
            match.status === "ready" ? "border-primary/30" :
            "border-border"
          )}>
            <div className="flex items-center gap-2 text-sm">
              <span className={cn(
                "flex-1 text-xs font-medium text-right",
                match.winnerId === match.participant1Id ? "text-green-400" : ""
              )}>
                {match.participant1?.name || "TBD"}
              </span>
              <span className="text-xs text-muted-foreground px-2">vs</span>
              <span className={cn(
                "flex-1 text-xs font-medium text-left",
                match.winnerId === match.participant2Id ? "text-green-400" : ""
              )}>
                {match.participant2?.name || "TBD"}
              </span>
            </div>

            {match.status === "ready" && isOrganizer && (
              <Button size="sm" onClick={() => onStartMatch(match.id)} disabled={startMatchPending}
                className="w-full h-7 text-xs gap-1 mt-2">
                {startMatchPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Start
              </Button>
            )}
            {match.status === "in-progress" && isOrganizer && match.participant1 && match.participant2 && (
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="outline" onClick={() => onReportResult(match.id, match.participant1Id)}
                  disabled={reportResultPending} className="flex-1 h-7 text-xs text-green-400 border-green-500/30">
                  {match.participant1.name} wins
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReportResult(match.id, match.participant2Id)}
                  disabled={reportResultPending} className="flex-1 h-7 text-xs text-green-400 border-green-500/30">
                  {match.participant2.name} wins
                </Button>
              </div>
            )}
            {match.status === "in-progress" && match.gameId && (
              <Button size="sm" variant="ghost" onClick={() => onViewGame(match.gameId)}
                className="w-full h-7 text-xs gap-1 mt-2">
                <Eye className="w-3 h-3" /> View Live Game
              </Button>
            )}
            {match.status === "completed" && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                <Trophy className="w-3 h-3 text-green-400" />
                <span className="text-[10px] text-green-400">{match.winner?.name} won</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
