-- Additional performance indexes for tables added after initial index migration
-- All use IF NOT EXISTS for safe re-runs

-- Users: soft-delete filtering and pagination
CREATE INDEX IF NOT EXISTS `idx_users_deleted` ON `users` (`isDeleted`);
CREATE INDEX IF NOT EXISTS `idx_users_created` ON `users` (`createdAt`);

-- Courts: admin verification filter
CREATE INDEX IF NOT EXISTS `idx_courts_verified` ON `courts` (`isVerified`);

-- Games: pagination by creation date
CREATE INDEX IF NOT EXISTS `idx_games_created` ON `games` (`createdAt`);

-- Challenges: lookup by challenger, challenged, and status
CREATE INDEX IF NOT EXISTS `idx_challenges_challenger` ON `challenges` (`challengerId`);
CREATE INDEX IF NOT EXISTS `idx_challenges_challenged` ON `challenges` (`challengedId`);
CREATE INDEX IF NOT EXISTS `idx_challenges_status` ON `challenges` (`status`);

-- Game Results: lookup by game
CREATE INDEX IF NOT EXISTS `idx_game_results_game` ON `game_results` (`gameId`);

-- Game Rounds: lookup by game
CREATE INDEX IF NOT EXISTS `idx_game_rounds_game` ON `game_rounds` (`gameId`);

-- Coaching Reviews: lookup by coaching session and user
CREATE INDEX IF NOT EXISTS `idx_coaching_reviews_coaching` ON `coaching_reviews` (`coachingId`);
CREATE INDEX IF NOT EXISTS `idx_coaching_reviews_user` ON `coaching_reviews` (`userId`);

-- Coaching Announcements: lookup by coaching session
CREATE INDEX IF NOT EXISTS `idx_coaching_announcements_coaching` ON `coaching_announcements` (`coachingId`);

-- Quest Claims: lookup by user
CREATE INDEX IF NOT EXISTS `idx_quest_claims_user` ON `quest_claims` (`userId`);

-- Tournaments: pagination and filtering
CREATE INDEX IF NOT EXISTS `idx_tournaments_status` ON `tournaments` (`status`);
CREATE INDEX IF NOT EXISTS `idx_tournaments_created` ON `tournaments` (`createdAt`);
CREATE INDEX IF NOT EXISTS `idx_tournaments_organizer` ON `tournaments` (`organizerId`);
CREATE INDEX IF NOT EXISTS `idx_tournaments_group` ON `tournaments` (`groupId`);

-- Tournament Participants: lookup by tournament and user
CREATE INDEX IF NOT EXISTS `idx_tournament_participants_tournament` ON `tournament_participants` (`tournamentId`);
CREATE INDEX IF NOT EXISTS `idx_tournament_participants_user` ON `tournament_participants` (`userId`);

-- Tournament Matches: lookup by tournament and round
CREATE INDEX IF NOT EXISTS `idx_tournament_matches_tournament` ON `tournament_matches` (`tournamentId`);
CREATE INDEX IF NOT EXISTS `idx_tournament_matches_round` ON `tournament_matches` (`tournamentId`, `roundNumber`);

-- Court Submissions: lookup by submitter and status
CREATE INDEX IF NOT EXISTS `idx_court_submissions_user` ON `court_submissions` (`submittedBy`);
CREATE INDEX IF NOT EXISTS `idx_court_submissions_status` ON `court_submissions` (`status`);

-- Court Bookings: lookup by court, user, and time
CREATE INDEX IF NOT EXISTS `idx_court_bookings_court` ON `court_bookings` (`courtId`);
CREATE INDEX IF NOT EXISTS `idx_court_bookings_user` ON `court_bookings` (`userId`);

-- Activity Feed: user timeline and pagination
CREATE INDEX IF NOT EXISTS `idx_activity_feed_user` ON `activity_feed` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_activity_feed_created` ON `activity_feed` (`createdAt`);

-- Message Reactions: lookup by message
CREATE INDEX IF NOT EXISTS `idx_message_reactions_message` ON `message_reactions` (`messageId`);

-- Court Photos: lookup by court
CREATE INDEX IF NOT EXISTS `idx_court_photos_court` ON `court_photos` (`courtId`);

-- Rivalries: lookup by either user
CREATE INDEX IF NOT EXISTS `idx_rivalries_user1` ON `rivalries` (`user1Id`);
CREATE INDEX IF NOT EXISTS `idx_rivalries_user2` ON `rivalries` (`user2Id`);

-- Favorite Players: lookup by user
CREATE INDEX IF NOT EXISTS `idx_favorite_players_user` ON `favorite_players` (`userId`);

-- Referrals: lookup by referrer
CREATE INDEX IF NOT EXISTS `idx_referrals_referrer` ON `referrals` (`referrerId`);

-- Feed Posts: user timeline composite
CREATE INDEX IF NOT EXISTS `idx_feed_posts_user_created` ON `feed_posts` (`userId`, `createdAt`);

-- Feed Comments: lookup by post
CREATE INDEX IF NOT EXISTS `idx_feed_comments_post` ON `feed_comments` (`postId`);

-- Feed Likes: lookup by post
CREATE INDEX IF NOT EXISTS `idx_feed_likes_post` ON `feed_likes` (`postId`);

-- Feed Reactions: lookup by post
CREATE INDEX IF NOT EXISTS `idx_feed_reactions_post` ON `feed_reactions` (`postId`);

-- Feed Bookmarks: lookup by user
CREATE INDEX IF NOT EXISTS `idx_feed_bookmarks_user` ON `feed_bookmarks` (`userId`);

-- User Photos: lookup by user
CREATE INDEX IF NOT EXISTS `idx_user_photos_user` ON `user_photos` (`userId`);

-- Notification Preferences: lookup by user
CREATE INDEX IF NOT EXISTS `idx_notif_prefs_user` ON `notification_preferences` (`userId`);

-- Push Subscriptions: lookup by user
CREATE INDEX IF NOT EXISTS `idx_push_subs_user` ON `push_subscriptions` (`userId`);
