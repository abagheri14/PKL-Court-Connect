import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, float, json, decimal, index, uniqueIndex } from "drizzle-orm/mysql-core";

// =============================================================================
// USERS
// =============================================================================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 50 }).unique(),
  name: text("name"),
  nickname: varchar("nickname", { length: 50 }),
  showFullName: boolean("showFullName").default(false).notNull(),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  dateOfBirth: timestamp("dateOfBirth"),
  age: int("age"),
  phone: varchar("phone", { length: 20 }),

  // Profile fields
  gender: mysqlEnum("gender", ["male", "female", "non-binary", "prefer-not-to-say"]),
  hasProfilePhoto: boolean("hasProfilePhoto").default(false).notNull(),
  profilePhotoUrl: text("profilePhotoUrl"),
  bio: text("bio"),
  publicKey: text("publicKey"),
  isVerified: boolean("isVerified").default(false).notNull(),
  isPhotoVerified: boolean("isPhotoVerified").default(false).notNull(),
  isRatingVerified: boolean("isRatingVerified").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),

  // Skill & Preferences
  skillLevel: varchar("skillLevel", { length: 20 }),
  officialRating: float("officialRating"),
  ratingType: varchar("ratingType", { length: 50 }),
  vibe: mysqlEnum("vibe", ["competitive", "social", "both"]).default("both"),
  pace: mysqlEnum("pace", ["fast", "rally", "both"]).default("both"),
  playStyle: text("playStyle"),
  handedness: mysqlEnum("handedness", ["left", "right", "ambidextrous"]).default("right"),
  goals: text("goals"),
  courtPreference: mysqlEnum("courtPreference", ["indoor", "outdoor", "both"]).default("both"),

  // Availability
  availabilityWeekdays: boolean("availabilityWeekdays").default(true).notNull(),
  availabilityWeekends: boolean("availabilityWeekends").default(true).notNull(),
  availabilityMornings: boolean("availabilityMornings").default(true).notNull(),
  availabilityAfternoons: boolean("availabilityAfternoons").default(true).notNull(),
  availabilityEvenings: boolean("availabilityEvenings").default(true).notNull(),
  playFrequency: mysqlEnum("playFrequency", ["once-month", "once-week", "2-3-week", "daily"]),
  availability: text("availability"),

  // Location
  latitude: float("latitude"),
  longitude: float("longitude"),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  locationUpdatedAt: timestamp("locationUpdatedAt"),

  // Gamification
  xp: int("xp").default(0).notNull(),
  weeklyXp: int("weeklyXp").default(0).notNull(),
  weeklyXpResetAt: timestamp("weeklyXpResetAt"),
  level: int("level").default(1).notNull(),
  currentStreak: int("currentStreak").default(0).notNull(),
  longestStreak: int("longestStreak").default(0).notNull(),
  lastLoginDate: timestamp("lastLoginDate"),

  // Premium
  isPremium: boolean("isPremium").default(false).notNull(),
  premiumUntil: timestamp("premiumUntil"),
  profileBoostsRemaining: int("profileBoostsRemaining").default(0).notNull(),
  profileBoostedUntil: timestamp("profileBoostedUntil"),
  readReceipts: boolean("readReceipts").default(false).notNull(),
  ghostMode: boolean("ghostMode").default(false).notNull(),
  travelModeLat: float("travelModeLat"),
  travelModeLng: float("travelModeLng"),
  travelModeCity: varchar("travelModeCity", { length: 100 }),

  // Stats
  totalGames: int("totalGames").default(0).notNull(),
  totalWins: int("totalWins").default(0).notNull(),
  totalLosses: int("totalLosses").default(0).notNull(),
  totalMatches: int("totalMatches").default(0).notNull(),
  averageRating: float("averageRating").default(0).notNull(),
  swipesUsedToday: int("swipesUsedToday").default(0).notNull(),
  maxDailySwipes: int("maxDailySwipes").default(10).notNull(),

  // Profile completion
  profileCompletion: int("profileCompletion").default(0).notNull(),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),

  // Preferences
  preferredFormat: text("preferredFormat"),

  // Matching preferences
  ageMin: int("ageMin"),
  ageMax: int("ageMax"),
  genderPreference: text("genderPreference"),
  skillRatingMin: float("skillRatingMin"),
  skillRatingMax: float("skillRatingMax"),
  maxDistance: int("maxDistance").default(25).notNull(),
  freeCourtsOnly: boolean("freeCourtsOnly").default(false).notNull(),

  // Soft delete
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email),
  locationIdx: index("idx_users_location").on(table.latitude, table.longitude),
  roleIdx: index("idx_users_role").on(table.role),
  activeIdx: index("idx_users_active").on(table.isActive, table.isDeleted),
  skillIdx: index("idx_users_skill").on(table.skillLevel),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// =============================================================================
// USER PHOTOS (Multiple profile photos)
// =============================================================================
export const userPhotos = mysqlTable("user_photos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  photoUrl: text("photoUrl").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_user_photos_user").on(table.userId),
}));

// =============================================================================
// MATCHES
// =============================================================================
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  user1Id: int("user1Id").notNull(),
  user2Id: int("user2Id").notNull(),
  matchedAt: timestamp("matchedAt").defaultNow().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  unmatchedBy: int("unmatchedBy"),
  unmatchedAt: timestamp("unmatchedAt"),
}, (table) => ({
  user1Idx: index("idx_matches_user1").on(table.user1Id),
  user2Idx: index("idx_matches_user2").on(table.user2Id),
  activeIdx: index("idx_matches_active").on(table.isActive),
}));
// =============================================================================
export const swipes = mysqlTable("swipes", {
  id: int("id").autoincrement().primaryKey(),
  swiperId: int("swiperId").notNull(),
  swipedId: int("swipedId").notNull(),
  direction: mysqlEnum("direction", ["rally", "pass"]).notNull(),
  isSuperRally: boolean("isSuperRally").default(false).notNull(),
  swipedAt: timestamp("swipedAt").defaultNow().notNull(),
}, (table) => ({
  swiperIdx: index("idx_swipes_swiper").on(table.swiperId),
  pairIdx: uniqueIndex("idx_swipes_pair").on(table.swiperId, table.swipedId),
}));
// =============================================================================
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["direct", "group"]).default("direct").notNull(),
  name: varchar("name", { length: 100 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastMessageAt: timestamp("lastMessageAt"),
  isActive: boolean("isActive").default(true).notNull(),
});

export const conversationParticipants = mysqlTable("conversation_participants", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
  isAdmin: boolean("isAdmin").default(false).notNull(),
  lastReadAt: timestamp("lastReadAt"),
}, (table) => ({
  convIdx: index("idx_cp_conversation").on(table.conversationId),
  userIdx: index("idx_cp_user").on(table.userId),
}));
// =============================================================================
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(),
  content: text("content"),
  messageType: mysqlEnum("messageType", ["text", "image", "video", "location_pin", "system"]).default("text").notNull(),
  locationLat: float("locationLat"),
  locationLng: float("locationLng"),
  locationName: varchar("locationName", { length: 255 }),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  isEdited: boolean("isEdited").default(false).notNull(),
  editedAt: timestamp("editedAt"),
}, (table) => ({
  convIdx: index("idx_messages_conv").on(table.conversationId, table.sentAt),
  senderIdx: index("idx_messages_sender").on(table.senderId),
}));
// =============================================================================
export const courts = mysqlTable("courts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  latitude: float("latitude").notNull(),
  longitude: float("longitude").notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("US"),
  courtType: mysqlEnum("courtType", ["indoor", "outdoor", "both"]).default("outdoor").notNull(),
  numCourts: int("numCourts").default(1).notNull(),
  surfaceType: varchar("surfaceType", { length: 50 }),
  lighting: boolean("lighting").default(false).notNull(),
  isFree: boolean("isFree").default(true).notNull(),
  costInfo: text("costInfo"),
  amenities: text("amenities"),
  addedBy: int("addedBy"),
  isVerified: boolean("isVerified").default(false).notNull(),
  averageRating: float("averageRating").default(0).notNull(),
  totalReviews: int("totalReviews").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  locationIdx: index("idx_courts_location").on(table.latitude, table.longitude),
  cityIdx: index("idx_courts_city").on(table.city),
  typeIdx: index("idx_courts_type").on(table.courtType),
}));

// =============================================================================
// COURT REVIEWS
// =============================================================================
export const courtReviews = mysqlTable("court_reviews", {
  id: int("id").autoincrement().primaryKey(),
  courtId: int("courtId").notNull(),
  userId: int("userId").notNull(),
  rating: float("rating").notNull(),
  comment: text("comment"),
  photos: text("photos"),
  helpfulCount: int("helpfulCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  courtIdx: index("idx_court_reviews_court").on(table.courtId),
}));

// =============================================================================
// GAMES
// =============================================================================
export const games = mysqlTable("games", {
  id: int("id").autoincrement().primaryKey(),
  organizerId: int("organizerId").notNull(),
  groupId: int("groupId"),
  courtId: int("courtId"),
  locationLat: float("locationLat"),
  locationLng: float("locationLng"),
  locationName: varchar("locationName", { length: 255 }),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: int("durationMinutes").default(90).notNull(),
  gameType: mysqlEnum("gameType", ["casual", "competitive", "tournament", "practice"]).default("casual").notNull(),
  format: mysqlEnum("format", ["singles", "mens-doubles", "womens-doubles", "mixed-doubles"]).default("mixed-doubles").notNull(),
  maxPlayers: int("maxPlayers").default(4).notNull(),
  skillLevelMin: varchar("skillLevelMin", { length: 10 }),
  skillLevelMax: varchar("skillLevelMax", { length: 10 }),
  isOpen: boolean("isOpen").default(true).notNull(),
  notes: text("notes"),
  pointsToWin: int("pointsToWin").default(11).notNull(),
  bestOf: int("bestOf").default(3).notNull(),
  winBy: int("winBy").default(2).notNull(),
  status: mysqlEnum("status", ["scheduled", "in-progress", "completed", "cancelled"]).default("scheduled").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  organizerIdx: index("idx_games_organizer").on(table.organizerId),
  groupIdx: index("idx_games_group").on(table.groupId),
  statusIdx: index("idx_games_status").on(table.status),
  scheduledIdx: index("idx_games_schedule").on(table.scheduledAt),
}));

export const gameParticipants = mysqlTable("game_participants", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["confirmed", "pending", "declined"]).default("confirmed").notNull(),
  feedbackGiven: boolean("feedbackGiven").default(false).notNull(),
}, (table) => ({
  gameIdx: index("idx_gp_game").on(table.gameId),
  userIdx: index("idx_gp_user").on(table.userId),
}));

export const gameFeedback = mysqlTable("game_feedback", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull(),
  reviewerId: int("reviewerId").notNull(),
  reviewedId: int("reviewedId").notNull(),
  rating: int("rating").notNull(),
  skillAccurate: boolean("skillAccurate").default(true).notNull(),
  goodSport: boolean("goodSport").default(true).notNull(),
  onTime: boolean("onTime").default(true).notNull(),
  wouldPlayAgain: boolean("wouldPlayAgain").default(true).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// =============================================================================
// CHALLENGES
// =============================================================================
export const challenges = mysqlTable("challenges", {
  id: int("id").autoincrement().primaryKey(),
  challengerId: int("challengerId").notNull(),
  challengedId: int("challengedId").notNull(),
  gameType: mysqlEnum("gameType", ["casual", "competitive", "tournament", "practice"]).default("casual").notNull(),
  format: mysqlEnum("format", ["singles", "mens-doubles", "womens-doubles", "mixed-doubles"]).default("singles").notNull(),
  message: text("message"),
  // Full game details
  courtId: int("courtId"),
  locationName: varchar("locationName", { length: 255 }),
  scheduledAt: timestamp("scheduledAt"),
  durationMinutes: int("durationMinutes").default(90).notNull(),
  skillLevelMin: varchar("skillLevelMin", { length: 10 }),
  skillLevelMax: varchar("skillLevelMax", { length: 10 }),
  maxPlayers: int("maxPlayers").default(2),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "accepted", "declined", "expired"]).default("pending").notNull(),
  gameId: int("gameId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
}, (table) => ({
  challengerIdx: index("idx_challenges_challenger").on(table.challengerId),
  challengedIdx: index("idx_challenges_challenged").on(table.challengedId),
  statusIdx: index("idx_challenges_status").on(table.status),
}));

// =============================================================================
// ENDORSEMENTS
// =============================================================================
export const endorsements = mysqlTable("endorsements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endorserId: int("endorserId").notNull(),
  endorsementType: mysqlEnum("endorsementType", ["good-sport", "on-time", "accurate-rater", "great-partner", "skilled-player"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueEndorsement: uniqueIndex("idx_endorsements_unique").on(table.userId, table.endorserId, table.endorsementType),
}));

// =============================================================================
// ACHIEVEMENTS
// =============================================================================
export const achievements = mysqlTable("achievements", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 255 }),
  category: mysqlEnum("category", ["social", "games", "profile", "community"]).notNull(),
  points: int("points").default(0).notNull(),
  requirementType: varchar("requirementType", { length: 50 }),
  requirementValue: int("requirementValue").default(1),
});

export const userAchievements = mysqlTable("user_achievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: int("achievementId").notNull(),
  earnedAt: timestamp("earnedAt"),
  claimedAt: timestamp("claimedAt"),
  progress: int("progress").default(0).notNull(),
  maxProgress: int("maxProgress").default(1).notNull(),
});

// =============================================================================
// NOTIFICATIONS
// =============================================================================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["match", "message", "game_invite", "achievement", "system", "tournament_invite"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  link: varchar("link", { length: 255 }),
  targetId: int("targetId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_notif_user").on(table.userId, table.isRead),
}));

// =============================================================================
// BLOCKS & REPORTS
// =============================================================================
export const blocks = mysqlTable("blocks", {
  id: int("id").autoincrement().primaryKey(),
  blockerId: int("blockerId").notNull(),
  blockedId: int("blockedId").notNull(),
  blockedAt: timestamp("blockedAt").defaultNow().notNull(),
  reason: text("reason"),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reporterId: int("reporterId").notNull(),
  reportedId: int("reportedId").notNull(),
  reportType: mysqlEnum("reportType", ["inappropriate", "fake-profile", "harassment", "safety", "other"]).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "reviewed", "action-taken", "dismissed"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// =============================================================================
// GROUPS
// =============================================================================
export const groups = mysqlTable("pkl_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  groupType: mysqlEnum("groupType", ["social", "league", "tournament", "coaching"]).default("social").notNull(),
  isPrivate: boolean("isPrivate").default(false).notNull(),
  createdBy: int("createdBy").notNull(),
  memberCount: int("memberCount").default(0).notNull(),
  locationCity: varchar("locationCity", { length: 100 }),
  photo: text("photo"),
  conversationId: int("conversationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const groupMembers = mysqlTable("group_members", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin", "moderator", "member"]).default("member").notNull(),
  status: mysqlEnum("memberStatus", ["active", "pending"]).default("active").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

// =============================================================================
// SHARED COACHING
// =============================================================================
export const sharedCoaching = mysqlTable("shared_coaching", {
  id: int("id").autoincrement().primaryKey(),
  organizerId: int("organizerId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coachName: varchar("coachName", { length: 100 }),
  location: varchar("location", { length: 255 }),
  courtId: int("courtId"),
  locationLat: float("locationLat"),
  locationLng: float("locationLng"),
  locationName: varchar("locationName", { length: 255 }),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: int("durationMinutes").default(60).notNull(),
  maxParticipants: int("maxParticipants").default(10).notNull(),
  costPerPerson: float("costPerPerson"),
  skillLevel: varchar("skillLevel", { length: 50 }),
  status: mysqlEnum("status", ["open", "full", "completed", "cancelled"]).default("open").notNull(),
  // Coaching plan & agenda
  agenda: text("agenda"),
  focusAreas: text("focusAreas"),
  drillPlan: text("drillPlan"),
  sessionNotes: text("sessionNotes"),
  equipmentNeeded: text("equipmentNeeded"),
  isVirtual: boolean("isVirtual").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const coachingParticipants = mysqlTable("coaching_participants", {
  id: int("id").autoincrement().primaryKey(),
  coachingId: int("coachingId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["confirmed", "pending", "cancelled"]).default("confirmed").notNull(),
  attended: boolean("attended").default(false).notNull(),
});

export const coachingReviews = mysqlTable("coaching_reviews", {
  id: int("id").autoincrement().primaryKey(),
  coachingId: int("coachingId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueReview: uniqueIndex("idx_coaching_reviews_unique").on(table.coachingId, table.userId),
}));

// =============================================================================
// COACHING ANNOUNCEMENTS (telegram-channel style messages from coach)
// =============================================================================
export const coachingAnnouncements = mysqlTable("coaching_announcements", {
  id: int("id").autoincrement().primaryKey(),
  coachingId: int("coachingId").notNull(),
  senderId: int("senderId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  coachingIdx: index("idx_coaching_announcements_coaching").on(table.coachingId),
}));

// =============================================================================
// QUEST CLAIMS
// =============================================================================
export const questClaims = mysqlTable("quest_claims", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questId: varchar("questId", { length: 100 }).notNull(),
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
}, (table) => ({
  userQuestIdx: uniqueIndex("idx_quest_claims_user_quest").on(table.userId, table.questId, table.claimedAt),
}));

// =============================================================================
// ADMIN USERS
// =============================================================================
export const adminUsers = mysqlTable("admin_users", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin", "superadmin"]).notNull(),
  permissions: text("permissions"),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  assignedBy: int("assignedBy"),
});

// =============================================================================
// APP SETTINGS
// =============================================================================
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});

// =============================================================================
// EMAIL VERIFICATION CODES
// =============================================================================
export const emailVerificationCodes = mysqlTable("email_verification_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_email_verify_userId").on(table.userId),
]);

// =============================================================================
// ARCHIVED USERS
// =============================================================================
export const archivedUsers = mysqlTable("archived_users", {
  id: int("id").autoincrement().primaryKey(),
  originalUserId: int("originalUserId").notNull(),
  profileSnapshot: text("profileSnapshot"),
  archivedAt: timestamp("archivedAt").defaultNow().notNull(),
  deletionReason: text("deletionReason"),
});

// =============================================================================
// GAME RESULTS
// =============================================================================
export const gameResults = mysqlTable("game_results", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull(),
  winnerTeam: mysqlEnum("winnerTeam", ["team1", "team2", "draw"]),
  team1Score: int("team1Score").notNull(),
  team2Score: int("team2Score").notNull(),
  team1PlayerIds: json("team1PlayerIds"),   // JSON array of user IDs
  team2PlayerIds: json("team2PlayerIds"),   // JSON array of user IDs
  recordedBy: int("recordedBy").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  scoreConfirmedBy: json("scoreConfirmedBy"),  // JSON array of user IDs who confirmed
  scoreDisputed: boolean("scoreDisputed").default(false),
}, (table) => ({
  gameIdx: uniqueIndex("idx_game_results_game").on(table.gameId),
}));

// =============================================================================
// GAME ROUNDS (per-round scoring for pickleball games)
// =============================================================================
export const gameRounds = mysqlTable("game_rounds", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull(),
  roundNumber: int("roundNumber").notNull(),
  team1Score: int("team1Score").default(0).notNull(),
  team2Score: int("team2Score").default(0).notNull(),
  winnerTeam: mysqlEnum("winnerTeam", ["team1", "team2"]),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  gameIdx: index("idx_game_rounds_game").on(table.gameId),
  uniqueRound: uniqueIndex("idx_game_rounds_unique").on(table.gameId, table.roundNumber),
}));

// =============================================================================
// NOTIFICATION PREFERENCES
// =============================================================================
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  matchNotif: boolean("matchNotif").default(true).notNull(),
  messageNotif: boolean("messageNotif").default(true).notNull(),
  gameInviteNotif: boolean("gameInviteNotif").default(true).notNull(),
  achievementNotif: boolean("achievementNotif").default(true).notNull(),
  systemNotif: boolean("systemNotif").default(true).notNull(),
  pushEnabled: boolean("pushEnabled").default(true).notNull(),
  emailEnabled: boolean("emailEnabled").default(false).notNull(),
  // Privacy settings
  showDistance: boolean("showDistance").default(true).notNull(),
  showOnline: boolean("showOnline").default(true).notNull(),
  publicProfile: boolean("publicProfile").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: uniqueIndex("idx_notif_prefs_user").on(table.userId),
}));

// =============================================================================
// PUSH SUBSCRIPTIONS
// =============================================================================
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_push_subs_user").on(table.userId),
}));

// =============================================================================
// PASSWORD RESET TOKENS
// =============================================================================
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("idx_prt_token").on(table.token),
  userIdx: index("idx_prt_user").on(table.userId),
}));

// =============================================================================
// ACCOUNT DELETION TOKENS
// =============================================================================
export const accountDeletionTokens = mysqlTable("account_deletion_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("idx_adt_token").on(table.token),
}));

// =============================================================================
// COURT SUBMISSIONS (user-submitted courts pending admin approval)
// =============================================================================
export const courtSubmissions = mysqlTable("court_submissions", {
  id: int("id").autoincrement().primaryKey(),
  submittedBy: int("submittedBy").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  latitude: float("latitude").notNull(),
  longitude: float("longitude").notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  courtType: mysqlEnum("courtType", ["indoor", "outdoor", "both"]).default("outdoor").notNull(),
  numCourts: int("numCourts").default(1).notNull(),
  surfaceType: varchar("surfaceType", { length: 50 }),
  lighting: boolean("lighting").default(false).notNull(),
  isFree: boolean("isFree").default(true).notNull(),
  costInfo: text("costInfo"),
  amenities: text("amenities"),
  photoUrl: text("photoUrl"),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNotes: text("adminNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("idx_cs_status").on(table.status),
  submitterIdx: index("idx_cs_submitter").on(table.submittedBy),
}));

// =============================================================================
// TOURNAMENTS
// =============================================================================
export const tournaments = mysqlTable("tournaments", {
  id: int("id").autoincrement().primaryKey(),
  organizerId: int("organizerId").notNull(),
  groupId: int("groupId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  format: mysqlEnum("tournamentFormat", ["single-elimination", "double-elimination", "round-robin"]).default("single-elimination").notNull(),
  gameFormat: mysqlEnum("gameFormat", ["singles", "mens-doubles", "womens-doubles", "mixed-doubles"]).default("singles").notNull(),
  maxParticipants: int("maxParticipants").default(16).notNull(),
  entryFee: float("entryFee"),
  prizeDescription: text("prizeDescription"),
  // Game rules
  pointsToWin: int("pointsToWin").default(11).notNull(),
  bestOf: int("bestOf").default(3).notNull(),
  winBy: int("winBy").default(2).notNull(),
  // Location
  courtId: int("courtId"),
  locationLat: float("locationLat"),
  locationLng: float("locationLng"),
  locationName: varchar("locationName", { length: 255 }),
  // Skill restrictions
  skillLevelMin: varchar("skillLevelMin", { length: 10 }),
  skillLevelMax: varchar("skillLevelMax", { length: 10 }),
  // Schedule
  registrationDeadline: timestamp("registrationDeadline"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  // State
  status: mysqlEnum("tournamentStatus", ["draft", "registration", "seeding", "in-progress", "completed", "cancelled"]).default("draft").notNull(),
  currentRound: int("currentRound").default(0).notNull(),
  totalRounds: int("totalRounds").default(0).notNull(),
  // Results
  winnerId: int("winnerId"),
  runnerUpId: int("runnerUpId"),
  // Metadata
  rules: text("rules"),
  isPublic: boolean("isPublic").default(true).notNull(),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  bannerUrl: text("bannerUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  organizerIdx: index("idx_tournaments_organizer").on(table.organizerId),
  statusIdx: index("idx_tournaments_status").on(table.status),
  startIdx: index("idx_tournaments_start").on(table.startDate),
  groupIdx: index("idx_tournaments_group").on(table.groupId),
}));

export const tournamentParticipants = mysqlTable("tournament_participants", {
  id: int("id").autoincrement().primaryKey(),
  tournamentId: int("tournamentId").notNull(),
  userId: int("userId").notNull(),
  partnerId: int("partnerId"),
  seed: int("seed"),
  status: mysqlEnum("participantStatus", ["registered", "confirmed", "checked-in", "eliminated", "withdrawn"]).default("registered").notNull(),
  wins: int("wins").default(0).notNull(),
  losses: int("losses").default(0).notNull(),
  pointDiff: int("pointDiff").default(0).notNull(),
  placement: int("placement"),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
}, (table) => ({
  tournamentIdx: index("idx_tp_tournament").on(table.tournamentId),
  userIdx: index("idx_tp_user").on(table.userId),
  uniqueEntry: uniqueIndex("idx_tp_unique").on(table.tournamentId, table.userId),
}));

export const tournamentMatches = mysqlTable("tournament_matches", {
  id: int("id").autoincrement().primaryKey(),
  tournamentId: int("tournamentId").notNull(),
  roundNumber: int("roundNumber").notNull(),
  matchNumber: int("matchNumber").notNull(),
  // Participants (nullable for byes and TBD)
  participant1Id: int("participant1Id"),
  participant2Id: int("participant2Id"),
  // Links to actual game for live scoring
  gameId: int("gameId"),
  // Scores
  participant1Score: int("participant1Score"),
  participant2Score: int("participant2Score"),
  // Result
  winnerId: int("winnerId"),
  loserId: int("loserId"),
  isBye: boolean("isBye").default(false).notNull(),
  // Bracket progression (which match does the winner/loser advance to)
  nextMatchId: int("nextMatchId"),
  loserNextMatchId: int("loserNextMatchId"),
  // Schedule
  scheduledAt: timestamp("scheduledAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  status: mysqlEnum("matchStatus", ["pending", "ready", "in-progress", "completed", "cancelled"]).default("pending").notNull(),
  courtAssignment: varchar("courtAssignment", { length: 100 }),
}, (table) => ({
  tournamentIdx: index("idx_tm_tournament").on(table.tournamentId),
  roundIdx: index("idx_tm_round").on(table.tournamentId, table.roundNumber),
  gameIdx: index("idx_tm_game").on(table.gameId),
  statusIdx: index("idx_tm_status").on(table.status),
}));

// =============================================================================
// COURT BOOKINGS (availability / time slot reservations)
// =============================================================================
export const courtBookings = mysqlTable("court_bookings", {
  id: int("id").autoincrement().primaryKey(),
  courtId: int("courtId").notNull(),
  userId: int("userId").notNull(),
  gameId: int("gameId"),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  courtNumber: int("courtNumber"),
  status: mysqlEnum("status", ["confirmed", "pending", "cancelled"]).default("confirmed").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  courtIdx: index("idx_cb_court").on(table.courtId),
  userIdx: index("idx_cb_user").on(table.userId),
  timeIdx: index("idx_cb_time").on(table.courtId, table.startTime, table.endTime),
}));

// =============================================================================
// ACTIVITY FEED (social feed events)
// =============================================================================
export const activityFeed = mysqlTable("activity_feed", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  activityType: mysqlEnum("activityType", [
    "achievement_earned", "game_completed", "tournament_won", "court_reviewed",
    "level_up", "streak_milestone", "new_match", "joined_group", "coaching_completed",
    "user_post",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  targetType: varchar("targetType", { length: 50 }),
  targetId: int("targetId"),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_af_user").on(table.userId),
  typeIdx: index("idx_af_type").on(table.activityType),
  createdIdx: index("idx_af_created").on(table.createdAt),
}));

// =============================================================================
// MESSAGE REACTIONS
// =============================================================================
export const messageReactions = mysqlTable("message_reactions", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  emoji: varchar("emoji", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  messageIdx: index("idx_mr_message").on(table.messageId),
  uniqueReaction: uniqueIndex("idx_mr_unique").on(table.messageId, table.userId, table.emoji),
}));

// =============================================================================
// COURT PHOTOS (multi-photo gallery for courts)
// =============================================================================
export const courtPhotos = mysqlTable("court_photos", {
  id: int("id").autoincrement().primaryKey(),
  courtId: int("courtId").notNull(),
  userId: int("userId").notNull(),
  photoUrl: text("photoUrl").notNull(),
  caption: varchar("caption", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  courtIdx: index("idx_cp2_court").on(table.courtId),
}));

// =============================================================================
// RIVALRIES (head-to-head records)
// =============================================================================
export const rivalries = mysqlTable("rivalries", {
  id: int("id").autoincrement().primaryKey(),
  user1Id: int("user1Id").notNull(),
  user2Id: int("user2Id").notNull(),
  user1Wins: int("user1Wins").default(0).notNull(),
  user2Wins: int("user2Wins").default(0).notNull(),
  totalGames: int("totalGames").default(0).notNull(),
  lastPlayedAt: timestamp("lastPlayedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  pairIdx: uniqueIndex("idx_rivalries_pair").on(table.user1Id, table.user2Id),
  user1Idx: index("idx_rivalries_user1").on(table.user1Id),
  user2Idx: index("idx_rivalries_user2").on(table.user2Id),
}));

// =============================================================================
// FAVORITE PLAYERS
// =============================================================================
export const favoritePlayers = mysqlTable("favorite_players", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  favoriteId: int("favoriteId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueFav: uniqueIndex("idx_fp_unique").on(table.userId, table.favoriteId),
  userIdx: index("idx_fp_user").on(table.userId),
}));

// =============================================================================
// REFERRAL CODES
// =============================================================================
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrerId").notNull(),
  referredId: int("referredId"),
  code: varchar("code", { length: 20 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "completed", "expired"]).default("pending").notNull(),
  xpRewarded: boolean("xpRewarded").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  referrerIdx: index("idx_ref_referrer").on(table.referrerId),
  codeIdx: uniqueIndex("idx_ref_code").on(table.code),
}));

// =============================================================================
// FEED POSTS (user-created social posts)
// =============================================================================
export const feedPosts = mysqlTable("feed_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  photoUrl: text("photoUrl"),
  postType: mysqlEnum("postType", ["general", "highlight", "question", "tip", "looking_for_players"]).default("general").notNull(),
  likesCount: int("likesCount").default(0).notNull(),
  commentsCount: int("commentsCount").default(0).notNull(),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_fp2_user").on(table.userId),
  typeIdx: index("idx_fp2_type").on(table.postType),
  createdIdx: index("idx_fp2_created").on(table.createdAt),
}));

// =============================================================================
// FEED COMMENTS (comments on posts or activity feed items)
// =============================================================================
export const feedComments = mysqlTable("feed_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  postIdx: index("idx_fc_post").on(table.postId),
  userIdx: index("idx_fc_user").on(table.userId),
}));

// =============================================================================
// FEED LIKES (likes on posts)
// =============================================================================
export const feedLikes = mysqlTable("feed_likes", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueLike: uniqueIndex("idx_fl_unique").on(table.postId, table.userId),
  postIdx: index("idx_fl_post").on(table.postId),
}));

// =============================================================================
// FEED REACTIONS (emoji reactions on posts - extends likes with emoji types)
// =============================================================================
export const feedReactions = mysqlTable("feed_reactions", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueReaction: uniqueIndex("idx_fr_unique").on(table.postId, table.userId, table.emoji),
  postIdx: index("idx_fr_post").on(table.postId),
}));

// =============================================================================
// FEED BOOKMARKS (saved posts)
// =============================================================================
export const feedBookmarks = mysqlTable("feed_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueBookmark: uniqueIndex("idx_fb_unique").on(table.postId, table.userId),
  userIdx: index("idx_fb_user").on(table.userId),
}));
