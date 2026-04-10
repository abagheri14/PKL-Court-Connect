import { relations } from "drizzle-orm";
import {
  users, matches, swipes, conversations, conversationParticipants,
  messages, courts, courtReviews, games, gameParticipants, gameFeedback,
  endorsements, achievements, userAchievements, notifications,
  blocks, reports, groups, groupMembers, sharedCoaching, coachingParticipants,
  adminUsers, challenges, gameResults, gameRounds, coachingReviews,
  coachingAnnouncements, questClaims, tournaments, tournamentParticipants,
  tournamentMatches, courtSubmissions, courtBookings, activityFeed,
  messageReactions, courtPhotos, rivalries, favoritePlayers, referrals,
  feedPosts, feedComments, feedLikes, feedReactions, feedBookmarks,
  userPhotos, emailVerificationCodes, passwordResetTokens,
  accountDeletionTokens, archivedUsers, notificationPreferences,
  pushSubscriptions,
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

// ── Challenges ──────────────────────────────────────────────────────────────
export const challengesRelations = relations(challenges, ({ one }) => ({
  challenger: one(users, { fields: [challenges.challengerId], references: [users.id], relationName: "challenger" }),
  challenged: one(users, { fields: [challenges.challengedId], references: [users.id], relationName: "challenged" }),
  game: one(games, { fields: [challenges.gameId], references: [games.id] }),
  court: one(courts, { fields: [challenges.courtId], references: [courts.id] }),
}));

// ── Game Results ────────────────────────────────────────────────────────────
export const gameResultsRelations = relations(gameResults, ({ one }) => ({
  game: one(games, { fields: [gameResults.gameId], references: [games.id] }),
  recorder: one(users, { fields: [gameResults.recordedBy], references: [users.id] }),
}));

// ── Game Rounds ─────────────────────────────────────────────────────────────
export const gameRoundsRelations = relations(gameRounds, ({ one }) => ({
  game: one(games, { fields: [gameRounds.gameId], references: [games.id] }),
}));

// ── Coaching Reviews ────────────────────────────────────────────────────────
export const coachingReviewsRelations = relations(coachingReviews, ({ one }) => ({
  coaching: one(sharedCoaching, { fields: [coachingReviews.coachingId], references: [sharedCoaching.id] }),
  user: one(users, { fields: [coachingReviews.userId], references: [users.id] }),
}));

// ── Coaching Announcements ──────────────────────────────────────────────────
export const coachingAnnouncementsRelations = relations(coachingAnnouncements, ({ one }) => ({
  coaching: one(sharedCoaching, { fields: [coachingAnnouncements.coachingId], references: [sharedCoaching.id] }),
  sender: one(users, { fields: [coachingAnnouncements.senderId], references: [users.id] }),
}));

// ── Quest Claims ────────────────────────────────────────────────────────────
export const questClaimsRelations = relations(questClaims, ({ one }) => ({
  user: one(users, { fields: [questClaims.userId], references: [users.id] }),
}));

// ── Tournaments ─────────────────────────────────────────────────────────────
export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  organizer: one(users, { fields: [tournaments.organizerId], references: [users.id] }),
  group: one(groups, { fields: [tournaments.groupId], references: [groups.id] }),
  court: one(courts, { fields: [tournaments.courtId], references: [courts.id] }),
  winner: one(users, { fields: [tournaments.winnerId], references: [users.id], relationName: "tournamentWinner" }),
  runnerUp: one(users, { fields: [tournaments.runnerUpId], references: [users.id], relationName: "tournamentRunnerUp" }),
  participants: many(tournamentParticipants),
  matches: many(tournamentMatches),
}));

export const tournamentParticipantsRelations = relations(tournamentParticipants, ({ one }) => ({
  tournament: one(tournaments, { fields: [tournamentParticipants.tournamentId], references: [tournaments.id] }),
  user: one(users, { fields: [tournamentParticipants.userId], references: [users.id] }),
}));

export const tournamentMatchesRelations = relations(tournamentMatches, ({ one }) => ({
  tournament: one(tournaments, { fields: [tournamentMatches.tournamentId], references: [tournaments.id] }),
  participant1: one(tournamentParticipants, { fields: [tournamentMatches.participant1Id], references: [tournamentParticipants.id], relationName: "matchParticipant1" }),
  participant2: one(tournamentParticipants, { fields: [tournamentMatches.participant2Id], references: [tournamentParticipants.id], relationName: "matchParticipant2" }),
  game: one(games, { fields: [tournamentMatches.gameId], references: [games.id] }),
  winnerParticipant: one(tournamentParticipants, { fields: [tournamentMatches.winnerId], references: [tournamentParticipants.id], relationName: "matchWinner" }),
}));

// ── Court Submissions ───────────────────────────────────────────────────────
export const courtSubmissionsRelations = relations(courtSubmissions, ({ one }) => ({
  submitter: one(users, { fields: [courtSubmissions.submittedBy], references: [users.id] }),
  reviewer: one(users, { fields: [courtSubmissions.reviewedBy], references: [users.id] }),
}));

// ── Court Bookings ──────────────────────────────────────────────────────────
export const courtBookingsRelations = relations(courtBookings, ({ one }) => ({
  court: one(courts, { fields: [courtBookings.courtId], references: [courts.id] }),
  user: one(users, { fields: [courtBookings.userId], references: [users.id] }),
  game: one(games, { fields: [courtBookings.gameId], references: [games.id] }),
}));

// ── Activity Feed ───────────────────────────────────────────────────────────
export const activityFeedRelations = relations(activityFeed, ({ one }) => ({
  user: one(users, { fields: [activityFeed.userId], references: [users.id] }),
}));

// ── Message Reactions ───────────────────────────────────────────────────────
export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, { fields: [messageReactions.messageId], references: [messages.id] }),
  user: one(users, { fields: [messageReactions.userId], references: [users.id] }),
}));

// ── Court Photos ────────────────────────────────────────────────────────────
export const courtPhotosRelations = relations(courtPhotos, ({ one }) => ({
  court: one(courts, { fields: [courtPhotos.courtId], references: [courts.id] }),
  user: one(users, { fields: [courtPhotos.userId], references: [users.id] }),
}));

// ── Rivalries ───────────────────────────────────────────────────────────────
export const rivalriesRelations = relations(rivalries, ({ one }) => ({
  user1: one(users, { fields: [rivalries.user1Id], references: [users.id], relationName: "rivalryUser1" }),
  user2: one(users, { fields: [rivalries.user2Id], references: [users.id], relationName: "rivalryUser2" }),
}));

// ── Favorite Players ────────────────────────────────────────────────────────
export const favoritePlayersRelations = relations(favoritePlayers, ({ one }) => ({
  user: one(users, { fields: [favoritePlayers.userId], references: [users.id] }),
  favorite: one(users, { fields: [favoritePlayers.favoriteId], references: [users.id] }),
}));

// ── Referrals ───────────────────────────────────────────────────────────────
export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, { fields: [referrals.referrerId], references: [users.id], relationName: "referrer" }),
  referred: one(users, { fields: [referrals.referredId], references: [users.id], relationName: "referred" }),
}));

// ── Feed Posts ───────────────────────────────────────────────────────────────
export const feedPostsRelations = relations(feedPosts, ({ one, many }) => ({
  user: one(users, { fields: [feedPosts.userId], references: [users.id] }),
  comments: many(feedComments),
  likes: many(feedLikes),
  reactions: many(feedReactions),
  bookmarks: many(feedBookmarks),
}));

export const feedCommentsRelations = relations(feedComments, ({ one }) => ({
  post: one(feedPosts, { fields: [feedComments.postId], references: [feedPosts.id] }),
  user: one(users, { fields: [feedComments.userId], references: [users.id] }),
}));

export const feedLikesRelations = relations(feedLikes, ({ one }) => ({
  post: one(feedPosts, { fields: [feedLikes.postId], references: [feedPosts.id] }),
  user: one(users, { fields: [feedLikes.userId], references: [users.id] }),
}));

export const feedReactionsRelations = relations(feedReactions, ({ one }) => ({
  post: one(feedPosts, { fields: [feedReactions.postId], references: [feedPosts.id] }),
  user: one(users, { fields: [feedReactions.userId], references: [users.id] }),
}));

export const feedBookmarksRelations = relations(feedBookmarks, ({ one }) => ({
  post: one(feedPosts, { fields: [feedBookmarks.postId], references: [feedPosts.id] }),
  user: one(users, { fields: [feedBookmarks.userId], references: [users.id] }),
}));

// ── User Photos ─────────────────────────────────────────────────────────────
export const userPhotosRelations = relations(userPhotos, ({ one }) => ({
  user: one(users, { fields: [userPhotos.userId], references: [users.id] }),
}));

// ── Email Verification Codes ────────────────────────────────────────────────
export const emailVerificationCodesRelations = relations(emailVerificationCodes, ({ one }) => ({
  user: one(users, { fields: [emailVerificationCodes.userId], references: [users.id] }),
}));

// ── Password Reset Tokens ───────────────────────────────────────────────────
export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

// ── Account Deletion Tokens ─────────────────────────────────────────────────
export const accountDeletionTokensRelations = relations(accountDeletionTokens, ({ one }) => ({
  user: one(users, { fields: [accountDeletionTokens.userId], references: [users.id] }),
}));

// ── Archived Users ──────────────────────────────────────────────────────────
export const archivedUsersRelations = relations(archivedUsers, ({ one }) => ({
  originalUser: one(users, { fields: [archivedUsers.originalUserId], references: [users.id] }),
}));

// ── Notification Preferences ────────────────────────────────────────────────
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, { fields: [notificationPreferences.userId], references: [users.id] }),
}));

// ── Push Subscriptions ──────────────────────────────────────────────────────
export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));
