import { relations } from "drizzle-orm";
import {
  users, matches, swipes, conversations, conversationParticipants,
  messages, courts, courtReviews, games, gameParticipants, gameFeedback,
  endorsements, achievements, userAchievements, notifications,
  blocks, reports, groups, groupMembers, sharedCoaching, coachingParticipants,
  adminUsers,
} from "./schema";

// ── Users ───────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  matchesAsUser1: many(matches, { relationName: "matchUser1" }),
  matchesAsUser2: many(matches, { relationName: "matchUser2" }),
  swipesMade: many(swipes, { relationName: "swiper" }),
  swipesReceived: many(swipes, { relationName: "swiped" }),
  sentMessages: many(messages),
  conversationParticipants: many(conversationParticipants),
  endorsementsGiven: many(endorsements, { relationName: "endorser" }),
  endorsementsReceived: many(endorsements, { relationName: "endorsed" }),
  userAchievements: many(userAchievements),
  notifications: many(notifications),
  organizedGames: many(games),
  gameParticipants: many(gameParticipants),
  courtReviews: many(courtReviews),
  reports: many(reports, { relationName: "reporter" }),
  blocksBy: many(blocks, { relationName: "blocker" }),
}));

// ── Matches ─────────────────────────────────────────────────────────────────
export const matchesRelations = relations(matches, ({ one }) => ({
  user1: one(users, { fields: [matches.user1Id], references: [users.id], relationName: "matchUser1" }),
  user2: one(users, { fields: [matches.user2Id], references: [users.id], relationName: "matchUser2" }),
}));

// ── Swipes ──────────────────────────────────────────────────────────────────
export const swipesRelations = relations(swipes, ({ one }) => ({
  swiper: one(users, { fields: [swipes.swiperId], references: [users.id], relationName: "swiper" }),
  swiped: one(users, { fields: [swipes.swipedId], references: [users.id], relationName: "swiped" }),
}));

// ── Conversations ───────────────────────────────────────────────────────────
export const conversationsRelations = relations(conversations, ({ many, one }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
  creator: one(users, { fields: [conversations.createdBy], references: [users.id] }),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, { fields: [conversationParticipants.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [conversationParticipants.userId], references: [users.id] }),
}));

// ── Messages ────────────────────────────────────────────────────────────────
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

// ── Courts ──────────────────────────────────────────────────────────────────
export const courtsRelations = relations(courts, ({ many, one }) => ({
  reviews: many(courtReviews),
  games: many(games),
  addedByUser: one(users, { fields: [courts.addedBy], references: [users.id] }),
}));

export const courtReviewsRelations = relations(courtReviews, ({ one }) => ({
  court: one(courts, { fields: [courtReviews.courtId], references: [courts.id] }),
  user: one(users, { fields: [courtReviews.userId], references: [users.id] }),
}));

// ── Games ────────────────────────────────────────────────────────────────────
export const gamesRelations = relations(games, ({ one, many }) => ({
  organizer: one(users, { fields: [games.organizerId], references: [users.id] }),
  court: one(courts, { fields: [games.courtId], references: [courts.id] }),
  participants: many(gameParticipants),
  feedback: many(gameFeedback),
}));

export const gameParticipantsRelations = relations(gameParticipants, ({ one }) => ({
  game: one(games, { fields: [gameParticipants.gameId], references: [games.id] }),
  user: one(users, { fields: [gameParticipants.userId], references: [users.id] }),
}));

export const gameFeedbackRelations = relations(gameFeedback, ({ one }) => ({
  game: one(games, { fields: [gameFeedback.gameId], references: [games.id] }),
  reviewer: one(users, { fields: [gameFeedback.reviewerId], references: [users.id] }),
  reviewed: one(users, { fields: [gameFeedback.reviewedId], references: [users.id] }),
}));

// ── Endorsements ────────────────────────────────────────────────────────────
export const endorsementsRelations = relations(endorsements, ({ one }) => ({
  user: one(users, { fields: [endorsements.userId], references: [users.id], relationName: "endorsed" }),
  endorser: one(users, { fields: [endorsements.endorserId], references: [users.id], relationName: "endorser" }),
}));

// ── Achievements ────────────────────────────────────────────────────────────
export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  achievement: one(achievements, { fields: [userAchievements.achievementId], references: [achievements.id] }),
}));

// ── Notifications ───────────────────────────────────────────────────────────
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// ── Blocks ──────────────────────────────────────────────────────────────────
export const blocksRelations = relations(blocks, ({ one }) => ({
  blocker: one(users, { fields: [blocks.blockerId], references: [users.id], relationName: "blocker" }),
  blocked: one(users, { fields: [blocks.blockedId], references: [users.id] }),
}));

// ── Reports ─────────────────────────────────────────────────────────────────
export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id], relationName: "reporter" }),
  reported: one(users, { fields: [reports.reportedId], references: [users.id] }),
  reviewedByUser: one(users, { fields: [reports.reviewedBy], references: [users.id] }),
}));

// ── Groups ──────────────────────────────────────────────────────────────────
export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, { fields: [groups.createdBy], references: [users.id] }),
  members: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

// ── Shared Coaching ─────────────────────────────────────────────────────────
export const sharedCoachingRelations = relations(sharedCoaching, ({ one, many }) => ({
  organizer: one(users, { fields: [sharedCoaching.organizerId], references: [users.id] }),
  participants: many(coachingParticipants),
}));

export const coachingParticipantsRelations = relations(coachingParticipants, ({ one }) => ({
  coaching: one(sharedCoaching, { fields: [coachingParticipants.coachingId], references: [sharedCoaching.id] }),
  user: one(users, { fields: [coachingParticipants.userId], references: [users.id] }),
}));

// ── Admin Users ─────────────────────────────────────────────────────────────
export const adminUsersRelations = relations(adminUsers, ({ one }) => ({
  user: one(users, { fields: [adminUsers.userId], references: [users.id] }),
  assignedByUser: one(users, { fields: [adminUsers.assignedBy], references: [users.id] }),
}));
