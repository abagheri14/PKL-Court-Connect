import { cn } from "@/lib/utils";
import { getInitials, getAvatarColor, getSilhouetteColor, type AvatarUser } from "@/lib/avatarUtils";
import { CheckCircle, Star, Crown } from "lucide-react";

interface PlayerAvatarProps {
  user: AvatarUser;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showBadges?: boolean;
  className?: string;
}

const sizeMap = {
  xs: "w-7 h-7 text-xs",
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-base",
  lg: "w-20 h-20 text-xl",
  xl: "w-28 h-28 text-3xl",
};

const badgeSizeMap = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
  xl: "w-6 h-6",
};

export default function PlayerAvatar({ user, size = "md", showBadges = true, className }: PlayerAvatarProps) {
  const initials = getInitials(user);

  // Infer hasProfilePhoto from profilePhotoUrl when not explicitly set
  const hasPhoto = user.hasProfilePhoto ?? !!user.profilePhotoUrl;

  const bgColor = hasPhoto
    ? getAvatarColor(user.id)
    : getSilhouetteColor(user.gender);

  return (
    <div className={cn("relative inline-flex flex-shrink-0", className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold text-white overflow-hidden",
          sizeMap[size],
          user.isPremium && "ring-2 ring-yellow-400 ring-offset-1 ring-offset-background",
        )}
        style={{ backgroundColor: bgColor }}
      >
        {hasPhoto && user.profilePhotoUrl ? (
          <>
            <img
              src={user.profilePhotoUrl}
              alt={initials}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to initials on load error
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement?.querySelector(".avatar-fallback")?.classList.remove("hidden");
              }}
            />
            <span className="avatar-fallback hidden font-bold absolute inset-0 flex items-center justify-center">{initials}</span>
          </>
        ) : hasPhoto ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/60">
            <span className="font-bold">{initials}</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {/* Silhouette SVG */}
            <svg viewBox="0 0 100 100" className="w-3/4 h-3/4 opacity-60">
              <circle cx="50" cy="35" r="20" fill="currentColor" />
              <ellipse cx="50" cy="85" rx="30" ry="25" fill="currentColor" />
            </svg>
            <span className="absolute font-bold">{initials}</span>
          </div>
        )}
      </div>

      {showBadges && (
        <>
          {user.isPremium && (
            <span className={cn("absolute -top-0.5 -right-0.5 text-secondary", badgeSizeMap[size])}>
              <Crown className="w-full h-full fill-secondary" />
            </span>
          )}
          {user.isPhotoVerified && hasPhoto && (
            <span className={cn("absolute -bottom-0.5 -right-0.5 text-green-400", badgeSizeMap[size])}>
              <CheckCircle className="w-full h-full fill-green-400 text-background" />
            </span>
          )}
          {user.isRatingVerified && (
            <span className={cn("absolute -bottom-0.5 -left-0.5 text-secondary", badgeSizeMap[size])}>
              <Star className="w-full h-full fill-secondary" />
            </span>
          )}
        </>
      )}
    </div>
  );
}
