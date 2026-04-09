/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// ── Public User Type (safe for client) ────────────────────────────────────
export type UserPublic = {
  id: number;
  openId: string;
  username: string | null;
  name: string | null;
  nickname: string | null;
  showFullName: boolean;
  email: string | null;
  role: "user" | "admin" | "superadmin";
  age: number | null;
  gender: "male" | "female" | "non-binary" | "prefer-not-to-say" | null;
  hasProfilePhoto: boolean;
  profilePhotoUrl: string | null;
  bio: string | null;
  publicKey: string | null;
  isVerified: boolean;
  isPhotoVerified: boolean;
  isRatingVerified: boolean;
  isActive: boolean;
  skillLevel: string | null;
  officialRating: number | null;
  ratingType: string | null;
  vibe: "competitive" | "social" | "both" | null;
  pace: "fast" | "rally" | "both" | null;
  playStyle: string | null;
  handedness: "left" | "right" | "ambidextrous" | null;
  goals: string | null;
  courtPreference: "indoor" | "outdoor" | "both" | null;
  availabilityWeekdays: boolean;
  availabilityWeekends: boolean;
  availabilityMornings: boolean;
  availabilityAfternoons: boolean;
  availabilityEvenings: boolean;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  isPremium: boolean;
  premiumUntil: Date | null;
  totalGames: number;
  totalMatches: number;
  averageRating: number;
  swipesUsedToday: number;
  maxDailySwipes: number;
  profileCompletion: number;
  onboardingCompleted: boolean;
  maxDistance: number;
  createdAt: Date;
  updatedAt: Date;
};

// ── Enriched Types for Frontend ───────────────────────────────────────────
export type NearbyUser = UserPublic & { distance: number };

export type MatchWithDetails = {
  id: number;
  matchedAt: Date;
  user: UserPublic;
  conversationId: number | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
};

export type ConversationWithDetails = {
  id: number;
  type: string;
  lastMessageAt: Date | null;
  participants: { id: number; name: string | null; profilePhotoUrl: string | null; hasProfilePhoto: boolean }[];
  lastMessage: string | null;
  unreadCount: number;
};

export type MessageWithSender = {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string | null;
  senderAvatar: string | null;
  content: string | null;
  messageType: "text" | "image" | "video" | "location_pin" | "system";
  locationLat: number | null;
  locationLng: number | null;
  locationName: string | null;
  sentAt: Date;
  readAt: Date | null;
};

export type GameWithDetails = {
  id: number;
  organizerId: number;
  courtId: number | null;
  locationName: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  gameType: string;
  format: string;
  maxPlayers: number;
  skillLevelMin: string | null;
  skillLevelMax: string | null;
  isOpen: boolean;
  notes: string | null;
  status: string;
  currentPlayers: number;
  participants: { userId: number; name: string | null; profilePhotoUrl: string | null }[];
};

export type AchievementWithProgress = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  points: number;
  earnedAt: Date | null;
  progress: number;
  maxProgress: number;
};

export type EndorsementSummary = {
  type: string;
  count: number;
};
