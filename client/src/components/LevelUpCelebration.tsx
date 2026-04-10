import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X, TrendingUp } from "lucide-react";

interface LevelUpCelebrationProps {
  newLevel: number;
  onClose: () => void;
}

/** Full-screen dopamine-hit level-up celebration */
export default function LevelUpCelebration({ newLevel, onClose }: LevelUpCelebrationProps) {
  const [show, setShow] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShowContent(true), 300);
    const autoClose = setTimeout(onClose, 6000);
    return () => { clearTimeout(t); clearTimeout(autoClose); };
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center transition-all duration-500",
        show ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-xl" />

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
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
            {["🏓", "⭐", "🔥", "💥", "🎉", "🏆", "✨", "💪"][i % 8]}
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
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-secondary/30 to-orange-500/20 flex items-center justify-center shadow-[0_0_60px_rgba(255,215,0,0.3)]">
            <TrendingUp size={56} className="text-secondary" />
          </div>
        </div>

        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-secondary via-yellow-300 to-orange-400 tracking-tight text-center animate-pulse-subtle mb-2">
          LEVEL UP!
        </h1>
        <p className="text-center text-white/60 text-sm mb-4">You reached a new level!</p>

        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-secondary to-orange-400 flex items-center justify-center shadow-[0_0_40px_rgba(255,215,0,0.4)] mb-6">
          <span className="text-5xl font-black text-black">{newLevel}</span>
        </div>

        <button
          onClick={onClose}
          className="w-full max-w-xs py-3.5 rounded-2xl bg-gradient-to-r from-secondary to-orange-400 text-black font-bold text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] transition-all active:scale-95"
        >
          🎉 Keep Playing
        </button>
      </div>
    </div>
  );
}
