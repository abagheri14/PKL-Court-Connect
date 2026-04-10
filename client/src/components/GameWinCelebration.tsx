import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X, Trophy } from "lucide-react";

interface GameWinCelebrationProps {
  gameType?: "casual" | "competitive" | "tournament";
  onClose: () => void;
}

/** Full-screen game/tournament win celebration */
export default function GameWinCelebration({ gameType = "casual", onClose }: GameWinCelebrationProps) {
  const [show, setShow] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShowContent(true), 300);
    const autoClose = setTimeout(onClose, 6000);
    return () => { clearTimeout(t); clearTimeout(autoClose); };
  }, [onClose]);

  const isTournament = gameType === "tournament";
  const title = isTournament ? "TOURNAMENT CHAMPION!" : "VICTORY!";
  const subtitle = isTournament
    ? "You dominated the tournament!"
    : "You won the game!";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center transition-all duration-500",
        show ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-xl" />

      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-celebration-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          >
            {["🏓", "🏆", "🥇", "⭐", "🔥", "💥", "🎉", "✨", "🎊", "👑"][i % 10]}
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all z-10"
      >
        <X size={20} />
      </button>

      <div className={cn(
        "relative z-10 flex flex-col items-center px-8 transition-all duration-700",
        showContent ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-90"
      )}>
        <div className="mb-6 animate-bounce-slow">
          <div className={cn(
            "w-28 h-28 rounded-3xl flex items-center justify-center shadow-[0_0_60px_rgba(255,215,0,0.3)]",
            isTournament
              ? "bg-gradient-to-br from-yellow-500/30 to-amber-600/20"
              : "bg-gradient-to-br from-green-500/30 to-emerald-600/20"
          )}>
            <Trophy size={56} className={isTournament ? "text-yellow-400" : "text-green-400"} />
          </div>
        </div>

        <h1 className={cn(
          "text-4xl font-black text-transparent bg-clip-text tracking-tight text-center animate-pulse-subtle mb-2",
          isTournament
            ? "bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400"
            : "bg-gradient-to-r from-green-400 via-emerald-300 to-cyan-400"
        )}>
          {title}
        </h1>
        <p className="text-center text-white/60 text-sm mb-6">{subtitle}</p>

        <div className="text-7xl mb-6 animate-bounce-slow">
          {isTournament ? "👑" : "🏆"}
        </div>

        <button
          onClick={onClose}
          className={cn(
            "w-full max-w-xs py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95",
            isTournament
              ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-black hover:shadow-[0_0_30px_rgba(255,215,0,0.3)]"
              : "bg-gradient-to-r from-green-400 to-emerald-500 text-black hover:shadow-[0_0_30px_rgba(34,197,94,0.3)]"
          )}
        >
          🎉 Awesome!
        </button>
      </div>
    </div>
  );
}
