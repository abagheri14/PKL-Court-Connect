import { useEffect, useState } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName } from "@/lib/avatarUtils";
import { X, Swords, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ChallengeReceivedProps {
  challenge: {
    id: number;
    challengerId: number;
    challengerName?: string | null;
    challengerUsername?: string | null;
    challengerNickname?: string | null;
    challengerPhoto?: string | null;
    gameType: string;
    format: string;
    message?: string | null;
  };
  onAccept: () => void;
  onDecline: () => void;
}

export default function ChallengeReceived({ challenge, onAccept, onDecline }: ChallengeReceivedProps) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const displayName = challenge.challengerNickname || challenge.challengerName || challenge.challengerUsername || "Someone";
  const challengerUser = {
    id: challenge.challengerId,
    profilePhotoUrl: challenge.challengerPhoto,
    hasProfilePhoto: !!challenge.challengerPhoto,
    name: displayName,
    username: challenge.challengerUsername,
  };

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShowContent(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={cn(
      "fixed inset-0 z-[200] flex items-center justify-center transition-all duration-500",
      show ? "opacity-100" : "opacity-0"
    )}>
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/90 via-background/95 to-background" />
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1.5 + Math.random() * 2}s`,
              background: i % 2 === 0
                ? "oklch(0.55 0.18 295 / 0.4)"
                : "oklch(0.85 0.20 95 / 0.4)",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className={cn(
        "relative z-10 flex flex-col items-center gap-6 px-8 transition-all duration-700",
        showContent ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-75 translate-y-8"
      )}>
        {/* Crossed swords icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center animate-bounce-gentle">
            <Swords size={40} className="text-secondary" />
          </div>
          <div className="absolute -inset-3 rounded-full border-2 border-secondary/30 animate-pulse" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground mb-1 tracking-tight">
            {t("challengeReceived.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("challengeReceived.wantsToPlay", { name: displayName })}
          </p>
        </div>

        {/* Challenger avatar */}
        <div className="relative">
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary to-secondary opacity-50 blur-lg animate-pulse" />
          <PlayerAvatar user={challengerUser} size="xl" className="relative" />
        </div>

        <p className="text-lg font-bold text-foreground">{displayName}</p>

        {/* Game details */}
        <div className="flex gap-3 items-center text-sm">
          <span className="sport-badge sport-badge-purple capitalize">{t(`gameTypes.${challenge.gameType}`)}</span>
          <span className="sport-badge sport-badge-cyan capitalize">{t(`gameFormats.${challenge.format}`)}</span>
        </div>

        {challenge.message && (
          <p className="text-sm text-muted-foreground italic text-center max-w-[260px]">
            "{challenge.message}"
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-4 mt-2 w-full max-w-xs">
          <button
            onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-muted/30 border border-border text-muted-foreground font-bold text-sm hover:bg-muted/50 transition-colors"
          >
            <X size={18} /> {t("challengeReceived.decline")}
          </button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-secondary to-secondary/80 text-background font-bold text-sm shadow-[0_4px_24px_rgba(255,215,0,0.3)] hover:shadow-[0_4px_32px_rgba(255,215,0,0.5)] transition-all active:scale-95"
          >
            <Check size={18} /> {t("challengeReceived.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
