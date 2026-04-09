import { useEffect, useState } from "react";
import { getDisplayName } from "@/lib/avatarUtils";
import PlayerAvatar from "@/components/PlayerAvatar";
import { useApp } from "@/contexts/AppContext";
import { X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface MatchCelebrationProps {
  player: any;
  onClose: () => void;
  onMessage: () => void;
}

/** Tinder-style match celebration — full-screen overlay with pickleball theme */
export default function MatchCelebration({ player, onClose, onMessage }: MatchCelebrationProps) {
  const [show, setShow] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const { user } = useApp();
  const { t } = useTranslation();
  const displayName = getDisplayName(player);

  useEffect(() => {
    // Stagger entrance
    requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-500",
        show ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-xl" />

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
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
            {i % 4 === 0 ? "🏓" : i % 4 === 1 ? "🎾" : i % 4 === 2 ? "⭐" : "🔥"}
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all z-10"
      >
        <X size={20} />
      </button>

      {/* Content */}
      <div className={cn(
        "relative z-10 flex flex-col items-center px-8 transition-all duration-700",
        showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}>
        {/* Rally title */}
        <div className="mb-8">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-secondary via-yellow-300 to-orange-400 tracking-tight text-center animate-pulse-subtle">
            {t("celebration.itsARally")}
          </h1>
          <p className="text-center text-white/60 text-sm mt-2">{t("celebration.wantToPlay", { name: displayName })}</p>
        </div>

        {/* Player avatars */}
        <div className="flex items-center gap-6 mb-10">
          {/* You */}
          <div className="relative">
            <div className="w-28 h-28 rounded-full ring-4 ring-secondary/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] overflow-hidden">
              {user ? (
                <PlayerAvatar user={{ id: user.id, name: user.name, profilePhotoUrl: user.profilePhotoUrl, hasProfilePhoto: !!user.profilePhotoUrl }} size="xl" showBadges={false} className="w-28 h-28" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-3xl">🏓</span>
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-secondary text-black text-[10px] font-bold whitespace-nowrap">
              You
            </div>
          </div>

          {/* Connection indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-3xl animate-bounce-slow">🤝</div>
          </div>

          {/* Match */}
          <div className="relative">
            <div className="w-28 h-28 rounded-full ring-4 ring-secondary/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] overflow-hidden">
              <PlayerAvatar user={player} size="xl" showBadges={false} className="w-28 h-28" />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-secondary text-black text-[10px] font-bold whitespace-nowrap max-w-[100px] truncate">
              {displayName}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={onMessage}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-secondary to-orange-400 text-black font-bold text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] transition-all active:scale-95"
          >
            <MessageCircle size={18} />
            {t("celebration.sendMessage")}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white/10 text-white/80 font-medium text-sm hover:bg-white/15 transition-all active:scale-95"
          >
            {t("celebration.keepSwiping")}
          </button>
        </div>
      </div>
    </div>
  );
}
