import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X, TrendingUp, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LevelUpCelebrationProps {
  newLevel: number;
  onClose: () => void;
}

const confettiEmojis = ["🏓", "⭐", "🔥", "💥", "🎉", "🏆", "✨", "💪", "🎊", "⚡", "🥳", "🌟"];
const confettiColors = ["#BFFF00", "#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#FB923C", "#34D399"];

/** Full-screen dopamine-hit level-up celebration */
export default function LevelUpCelebration({ newLevel, onClose }: LevelUpCelebrationProps) {
  const [phase, setPhase] = useState(0);
  const { t } = useTranslation(); // 0=hidden, 1=bg, 2=icon, 3=text, 4=number, 5=button

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 50),
      setTimeout(() => setPhase(2), 400),
      setTimeout(() => setPhase(3), 800),
      setTimeout(() => setPhase(4), 1200),
      setTimeout(() => setPhase(5), 1800),
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
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/85 to-black/90 backdrop-blur-2xl" />

      {/* Expanding ring pulses */}
      {phase >= 2 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          {[0, 0.3, 0.6, 0.9, 1.2].map((delay, i) => (
            <div key={i} className="absolute w-32 h-32 rounded-full border-2 border-secondary/40"
              style={{ animation: `ringExpand 2s ease-out ${delay}s infinite` }} />
          ))}
        </div>
      )}

      {/* Confetti shower */}
      {phase >= 2 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => {
            const isEmoji = i % 3 === 0;
            return (
              <div key={i} className="absolute" style={{
                left: `${Math.random() * 100}%`,
                animation: `confettiFall ${3 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
              }}>
                {isEmoji ? (
                  <span className="text-xl">{confettiEmojis[i % confettiEmojis.length]}</span>
                ) : (
                  <div className="w-2 h-3 rounded-sm" style={{
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
        {/* Icon */}
        {phase >= 2 && (
          <div className="mb-6" style={{ animation: "celebScaleIn 0.7s ease-out both" }}>
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-secondary/30 to-orange-500/20 flex items-center justify-center"
              style={{ animation: "glowPulse 2s ease-in-out infinite" }}>
              <TrendingUp size={56} className="text-secondary" />
            </div>
          </div>
        )}

        {/* Title */}
        {phase >= 3 && (
          <div style={{ animation: "celebScaleIn 0.6s ease-out both" }}>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={24} className="text-yellow-400" />
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-secondary via-yellow-300 to-orange-400 tracking-tight text-center">
                {t("celebration.levelUp")}
              </h1>
              <Zap size={24} className="text-yellow-400" />
            </div>
            <p className="text-center text-white/50 text-sm mb-6">{t("celebration.gettingStronger")} 💪</p>
          </div>
        )}

        {/* Level number with glow */}
        {phase >= 4 && (
          <div className="mb-8" style={{ animation: "numberReveal 0.8s ease-out both" }}>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-secondary/20 blur-2xl scale-150" />
              <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-secondary to-orange-400 flex items-center justify-center"
                style={{ animation: "glowPulse 1.5s ease-in-out infinite" }}>
                <span className="text-6xl font-black text-black">{newLevel}</span>
              </div>
            </div>
            <p className="text-center text-white/40 text-xs mt-3 font-medium tracking-widest uppercase">{t("celebration.levelTransition", { from: newLevel - 1, to: newLevel })}</p>
          </div>
        )}

        {/* CTA */}
        {phase >= 5 && (
          <button onClick={onClose}
            style={{ animation: "celebScaleIn 0.5s ease-out both" }}
            className="w-full max-w-xs py-3.5 rounded-2xl bg-gradient-to-r from-secondary to-orange-400 text-black font-bold text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] transition-all active:scale-95">
            🎉 {t("celebration.keepPlaying")}
          </button>
        )}
      </div>
    </div>
  );
}
