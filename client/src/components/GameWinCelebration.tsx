import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X, Trophy, Crown, Swords } from "lucide-react";

interface GameWinCelebrationProps {
  gameType?: "casual" | "competitive" | "tournament";
  onClose: () => void;
}

const confettiColors = ["#BFFF00", "#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#FB923C", "#34D399", "#F472B6"];
const tournamentEmojis = ["👑", "🏆", "🥇", "🎊", "⭐", "🔥", "💥", "🎉", "✨", "🌟", "💎", "🎯"];
const gameEmojis = ["🏓", "🏆", "🎉", "⭐", "🔥", "💪", "✨", "🎊", "🥳", "👏"];

/** Full-screen game/tournament win celebration */
export default function GameWinCelebration({ gameType = "casual", onClose }: GameWinCelebrationProps) {
  const [phase, setPhase] = useState(0);

  const isTournament = gameType === "tournament";
  const emojis = isTournament ? tournamentEmojis : gameEmojis;

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 50),
      setTimeout(() => setPhase(2), 400),
      setTimeout(() => setPhase(3), 900),
      setTimeout(() => setPhase(4), 1400),
      setTimeout(() => setPhase(5), 2000),
      setTimeout(onClose, 8000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onClose]);

  return (
    <div className={cn(
      "fixed inset-0 z-[200] flex flex-col items-center justify-center transition-all duration-500",
      phase >= 1 ? "opacity-100" : "opacity-0",
      phase === 2 && "animate-screen-shake"
    )}>
      {/* Background */}
      <div className={cn("absolute inset-0 backdrop-blur-2xl",
        isTournament
          ? "bg-gradient-to-b from-yellow-950/90 via-black/90 to-amber-950/90"
          : "bg-gradient-to-b from-green-950/90 via-black/90 to-emerald-950/90"
      )} />

      {/* Ring pulses */}
      {phase >= 2 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          {[0, 0.4, 0.8, 1.2].map((delay, i) => (
            <div key={i} className={cn("absolute w-40 h-40 rounded-full border-2",
              isTournament ? "border-yellow-400/30" : "border-green-400/30"
            )} style={{ animation: `ringExpand 2.5s ease-out ${delay}s infinite` }} />
          ))}
        </div>
      )}

      {/* Confetti */}
      {phase >= 2 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 60 }).map((_, i) => {
            const isEmoji = i % 3 === 0;
            return (
              <div key={i} className="absolute" style={{
                left: `${Math.random() * 100}%`,
                animation: `confettiFall ${2.5 + Math.random() * 3}s linear ${Math.random() * 1.5}s infinite`,
              }}>
                {isEmoji ? (
                  <span className="text-xl">{emojis[i % emojis.length]}</span>
                ) : (
                  <div className="w-2.5 h-3 rounded-sm" style={{
                    backgroundColor: confettiColors[i % confettiColors.length],
                    transform: `rotate(${Math.random() * 360}deg)`,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all z-10">
        <X size={20} />
      </button>

      <div className="relative z-10 flex flex-col items-center px-8">
        {/* Trophy / Crown */}
        {phase >= 2 && (
          <div className="mb-6" style={{ animation: "trophySpin 0.8s ease-out both" }}>
            <div className={cn("w-32 h-32 rounded-3xl flex items-center justify-center",
              isTournament
                ? "bg-gradient-to-br from-yellow-500/30 to-amber-600/20"
                : "bg-gradient-to-br from-green-500/30 to-emerald-600/20"
            )} style={{ animation: "glowPulse 1.5s ease-in-out infinite" }}>
              {isTournament
                ? <Crown size={64} className="text-yellow-400" />
                : <Trophy size={64} className="text-green-400" />
              }
            </div>
          </div>
        )}

        {/* Title */}
        {phase >= 3 && (
          <div style={{ animation: "celebScaleIn 0.6s ease-out both" }}>
            <h1 className={cn(
              "text-4xl font-black text-transparent bg-clip-text tracking-tight text-center mb-1",
              isTournament
                ? "bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400"
                : "bg-gradient-to-r from-green-400 via-emerald-300 to-cyan-400"
            )}>
              {isTournament ? "CHAMPION!" : "VICTORY!"}
            </h1>
            <p className="text-center text-white/50 text-sm mb-2">
              {isTournament ? "You dominated the tournament! 👑" : "Great game! You crushed it! 🏓"}
            </p>
          </div>
        )}

        {/* Middle emoji with stats feel */}
        {phase >= 4 && (
          <div className="my-6 flex items-center gap-4" style={{ animation: "numberReveal 0.8s ease-out both" }}>
            <div className="flex flex-col items-center">
              <Swords size={20} className="text-white/30 mb-1" />
              <span className="text-xs text-white/30 font-medium">Winner</span>
            </div>
            <div className="relative">
              <div className={cn("absolute inset-0 rounded-full blur-2xl scale-150",
                isTournament ? "bg-yellow-500/20" : "bg-green-500/20"
              )} />
              <div className="relative text-7xl" style={{ animation: "bounce-slow 1.5s ease-in-out infinite" }}>
                {isTournament ? "👑" : "🏆"}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <Trophy size={20} className="text-white/30 mb-1" />
              <span className="text-xs text-white/30 font-medium">+XP</span>
            </div>
          </div>
        )}

        {/* CTA */}
        {phase >= 5 && (
          <button onClick={onClose}
            style={{ animation: "celebScaleIn 0.5s ease-out both" }}
            className={cn(
              "w-full max-w-xs py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95",
              isTournament
                ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-black hover:shadow-[0_0_30px_rgba(255,215,0,0.3)]"
                : "bg-gradient-to-r from-green-400 to-emerald-500 text-black hover:shadow-[0_0_30px_rgba(34,197,94,0.3)]"
            )}>
            🎉 Awesome!
          </button>
        )}
      </div>
    </div>
  );
}
