// =============================================================================
// Gamification Engine for PKL Court Connect
// =============================================================================

export interface LevelInfo {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  tier: "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Legend";
}

export const XP_REWARDS = {
  PROFILE_COMPLETION: 500,
  DAILY_LOGIN: 50,
  STREAK_BONUS_7: 100,
  STREAK_BONUS_14: 200,
  STREAK_BONUS_30: 500,
  SUCCESSFUL_MATCH: 50,
  GAME_COMPLETION: 100,
  GAME_WIN: 50,
  REVIEW_WRITTEN: 75,
  ENDORSEMENT_GIVEN: 25,
  ENDORSEMENT_RECEIVED: 25,
  COURT_ADDED: 150,
  FIRST_GAME: 200,
  TOURNAMENT_PARTICIPATION: 250,
  TOURNAMENT_WIN: 500,
} as const;

export const LEVELS: LevelInfo[] = [
  { level: 1, title: "Newcomer", minXp: 0, maxXp: 250, tier: "Beginner" },
  { level: 2, title: "Learner", minXp: 250, maxXp: 500, tier: "Beginner" },
  { level: 3, title: "Novice", minXp: 500, maxXp: 1000, tier: "Beginner" },
  { level: 4, title: "Apprentice", minXp: 1000, maxXp: 1500, tier: "Beginner" },
  { level: 5, title: "Junior", minXp: 1500, maxXp: 2500, tier: "Beginner" },
  { level: 6, title: "Player", minXp: 2500, maxXp: 3500, tier: "Intermediate" },
  { level: 7, title: "Contender", minXp: 3500, maxXp: 5000, tier: "Intermediate" },
  { level: 8, title: "Competitor", minXp: 5000, maxXp: 6500, tier: "Intermediate" },
  { level: 9, title: "Challenger", minXp: 6500, maxXp: 8500, tier: "Intermediate" },
  { level: 10, title: "Veteran", minXp: 8500, maxXp: 10000, tier: "Intermediate" },
  { level: 11, title: "Skilled", minXp: 10000, maxXp: 12000, tier: "Advanced" },
  { level: 12, title: "Elite", minXp: 12000, maxXp: 14000, tier: "Advanced" },
  { level: 13, title: "Pro", minXp: 14000, maxXp: 16000, tier: "Advanced" },
  { level: 14, title: "Master", minXp: 16000, maxXp: 18000, tier: "Advanced" },
  { level: 15, title: "Grandmaster", minXp: 18000, maxXp: 20000, tier: "Advanced" },
  { level: 16, title: "Champion", minXp: 20000, maxXp: 23000, tier: "Expert" },
  { level: 17, title: "Legend", minXp: 23000, maxXp: 26000, tier: "Expert" },
  { level: 18, title: "Icon", minXp: 26000, maxXp: 30000, tier: "Expert" },
  { level: 19, title: "Virtuoso", minXp: 30000, maxXp: 34000, tier: "Expert" },
  { level: 20, title: "Titan", minXp: 34000, maxXp: 38000, tier: "Expert" },
  { level: 21, title: "Phenom", minXp: 38000, maxXp: 43000, tier: "Legend" },
  { level: 22, title: "Mythic", minXp: 43000, maxXp: 48000, tier: "Legend" },
  { level: 23, title: "Immortal", minXp: 48000, maxXp: 55000, tier: "Legend" },
  { level: 24, title: "Transcendent", minXp: 55000, maxXp: 65000, tier: "Legend" },
  { level: 25, title: "Pickleball God", minXp: 65000, maxXp: Infinity, tier: "Legend" },
];

export function getLevelInfo(xp: number): LevelInfo {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getLevelProgress(xp: number): number {
  const level = getLevelInfo(xp);
  if (level.maxXp === Infinity) return 100;
  const range = level.maxXp - level.minXp;
  const progress = xp - level.minXp;
  return Math.min(100, Math.round((progress / range) * 100));
}

export function getXpToNextLevel(xp: number): number {
  const level = getLevelInfo(xp);
  if (level.maxXp === Infinity) return 0;
  return level.maxXp - xp;
}

export function getTierColor(tier: LevelInfo["tier"]): string {
  switch (tier) {
    case "Beginner": return "#4CAF50";
    case "Intermediate": return "#17a2b8";
    case "Advanced": return "#A855F7";
    case "Expert": return "#FFD700";
    case "Legend": return "#FF5722";
  }
}

export function getStreakBonus(streak: number): number {
  if (streak >= 30) return XP_REWARDS.STREAK_BONUS_30;
  if (streak >= 14) return XP_REWARDS.STREAK_BONUS_14;
  if (streak >= 7) return XP_REWARDS.STREAK_BONUS_7;
  return 0;
}
