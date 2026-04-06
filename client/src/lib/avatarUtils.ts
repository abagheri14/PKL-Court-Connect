// =============================================================================
// Avatar & Privacy Utilities for PKL Court Connect
// =============================================================================

/** Minimal user shape needed by avatar utilities */
export type AvatarUser = {
  id: number | string;
  name?: string | null;
  nickname?: string | null;
  showFullName?: boolean;
  gender?: string | null;
  hasProfilePhoto?: boolean;
  profilePhotoUrl?: string | null;
  isPremium?: boolean;
  isVerified?: boolean;
  isPhotoVerified?: boolean;
  isRatingVerified?: boolean;
  skillLevel?: string | null;
  vibe?: string | null;
  city?: string | null;
  region?: string | null;
  age?: number | null;
  distance?: number;
};

/**
 * Get the display name based on user privacy settings
 */
export function getDisplayName(user: AvatarUser): string {
  if (user.showFullName && user.name) return user.name;
  if (user.nickname) return user.nickname;
  if (user.name) return user.name.split(" ")[0];
  return "Player";
}

/**
 * Get user initials for fallback avatar
 */
export function getInitials(user: AvatarUser): string {
  const name = (user.showFullName ? user.name : user.nickname || user.name) || "P";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Generate a consistent color for a user's avatar background
 */
export function getAvatarColor(userId: string | number): string {
  const colors = [
    "#6B2E9F", "#A855F7", "#FFD700", "#17a2b8",
    "#E91E63", "#9C27B0", "#4CAF50", "#FF5722",
  ];
  const id = String(userId);
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get gender-specific silhouette color
 */
export function getSilhouetteColor(gender?: string | null): string {
  switch (gender) {
    case "male":
      return "#64748b";
    case "female":
      return "#ec4899";
    case "non-binary":
      return "#a855f7";
    default:
      return "#eab308";
  }
}

/**
 * Check if photo verification badge should show
 */
export function shouldShowPhotoVerification(user: AvatarUser): boolean {
  return !!(user.isPhotoVerified && user.hasProfilePhoto);
}

/**
 * Get skill level display with color
 */
export function getSkillLevelColor(level: string): string {
  const num = parseFloat(level);
  if (num >= 5.0) return "#FFD700"; // Gold
  if (num >= 4.0) return "#A855F7"; // Purple
  if (num >= 3.0) return "#17a2b8"; // Cyan
  if (num >= 2.0) return "#4CAF50"; // Green
  return "#6c757d"; // Gray
}

/**
 * Get vibe display color
 */
export function getVibeColor(vibe: string): string {
  switch (vibe.toLowerCase()) {
    case "competitive":
      return "#E91E63";
    case "social":
      return "#17a2b8";
    case "both":
      return "#9C27B0";
    default:
      return "#6c757d";
  }
}

/**
 * Format distance display
 */
export function formatDistance(distance: number): string {
  if (distance < 0.1) return "< 0.1 mi";
  if (distance < 1) return `${distance.toFixed(1)} mi`;
  return `${distance.toFixed(1)} mi`;
}

/**
 * Format time ago
 */
export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
