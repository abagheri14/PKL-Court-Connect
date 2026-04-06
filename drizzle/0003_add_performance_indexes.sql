-- Performance indexes for production deployment
-- Covers frequently queried columns across all major tables

-- Users: lookup by email, username, role, and activity
CREATE INDEX IF NOT EXISTS `idx_users_email` ON `users` (`email`);
CREATE INDEX IF NOT EXISTS `idx_users_username` ON `users` (`username`);
CREATE INDEX IF NOT EXISTS `idx_users_role` ON `users` (`role`);

-- Swipes: lookup by swiper and swiped, date-based resets
CREATE INDEX IF NOT EXISTS `idx_swipes_swiper` ON `swipes` (`swiperId`);
CREATE INDEX IF NOT EXISTS `idx_swipes_swiped` ON `swipes` (`swipedId`);
CREATE INDEX IF NOT EXISTS `idx_swipes_created` ON `swipes` (`createdAt`);

-- Matches: lookup by both users and status
CREATE INDEX IF NOT EXISTS `idx_matches_user1` ON `matches` (`user1Id`);
CREATE INDEX IF NOT EXISTS `idx_matches_user2` ON `matches` (`user2Id`);
CREATE INDEX IF NOT EXISTS `idx_matches_status` ON `matches` (`status`);

-- Conversations: participant lookups
CREATE INDEX IF NOT EXISTS `idx_conv_participants_user` ON `conversation_participants` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_conv_participants_conv` ON `conversation_participants` (`conversationId`);

-- Messages: conversation message listing, sender lookup
CREATE INDEX IF NOT EXISTS `idx_messages_conv` ON `messages` (`conversationId`);
CREATE INDEX IF NOT EXISTS `idx_messages_sender` ON `messages` (`senderId`);
CREATE INDEX IF NOT EXISTS `idx_messages_created` ON `messages` (`createdAt`);

-- Games: organizer, status, and scheduling
CREATE INDEX IF NOT EXISTS `idx_games_organizer` ON `games` (`organizerId`);
CREATE INDEX IF NOT EXISTS `idx_games_status` ON `games` (`status`);
CREATE INDEX IF NOT EXISTS `idx_games_scheduled` ON `games` (`scheduledAt`);
CREATE INDEX IF NOT EXISTS `idx_games_court` ON `games` (`courtId`);

-- Game participants: user and game lookup
CREATE INDEX IF NOT EXISTS `idx_game_participants_user` ON `game_participants` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_game_participants_game` ON `game_participants` (`gameId`);

-- Notifications: user inbox ordering
CREATE INDEX IF NOT EXISTS `idx_notifications_user` ON `notifications` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_notifications_created` ON `notifications` (`createdAt`);
CREATE INDEX IF NOT EXISTS `idx_notifications_read` ON `notifications` (`isRead`);

-- Endorsements: per-user lookup
CREATE INDEX IF NOT EXISTS `idx_endorsements_user` ON `endorsements` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_endorsements_endorser` ON `endorsements` (`endorserId`);

-- User achievements: per-user lookup
CREATE INDEX IF NOT EXISTS `idx_user_achievements_user` ON `user_achievements` (`userId`);

-- Reports: status filtering for admin
CREATE INDEX IF NOT EXISTS `idx_reports_status` ON `reports` (`status`);
CREATE INDEX IF NOT EXISTS `idx_reports_reporter` ON `reports` (`reporterId`);

-- Blocks: bidirectional lookups
CREATE INDEX IF NOT EXISTS `idx_blocks_blocker` ON `blocks` (`blockerId`);
CREATE INDEX IF NOT EXISTS `idx_blocks_blocked` ON `blocks` (`blockedId`);

-- Groups: owner lookup
CREATE INDEX IF NOT EXISTS `idx_groups_owner` ON `groups` (`ownerId`);

-- Group members: user and group lookup
CREATE INDEX IF NOT EXISTS `idx_group_members_user` ON `group_members` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_group_members_group` ON `group_members` (`groupId`);

-- Court reviews: court and user lookup
CREATE INDEX IF NOT EXISTS `idx_court_reviews_court` ON `court_reviews` (`courtId`);
CREATE INDEX IF NOT EXISTS `idx_court_reviews_user` ON `court_reviews` (`userId`);

-- Game feedback: game lookup
CREATE INDEX IF NOT EXISTS `idx_game_feedback_game` ON `game_feedback` (`gameId`);
CREATE INDEX IF NOT EXISTS `idx_game_feedback_reviewer` ON `game_feedback` (`reviewerId`);

-- Coaching sessions: status and scheduling
CREATE INDEX IF NOT EXISTS `idx_coaching_status` ON `shared_coaching` (`status`);
CREATE INDEX IF NOT EXISTS `idx_coaching_scheduled` ON `shared_coaching` (`scheduledAt`);
CREATE INDEX IF NOT EXISTS `idx_coaching_organizer` ON `shared_coaching` (`organizerId`);

-- Coaching participants: coaching and user lookup
CREATE INDEX IF NOT EXISTS `idx_coaching_participants_coaching` ON `coaching_participants` (`coachingId`);
CREATE INDEX IF NOT EXISTS `idx_coaching_participants_user` ON `coaching_participants` (`userId`);
CREATE INDEX IF NOT EXISTS `idx_coaching_participants_status` ON `coaching_participants` (`status`);
