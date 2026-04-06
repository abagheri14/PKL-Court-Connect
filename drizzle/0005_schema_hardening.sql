-- Migration 0005: Schema hardening
-- Adds push_subscriptions, password_reset_tokens, account_deletion_tokens tables
-- Adds unique index on endorsements
-- Adds foreign key constraints on critical tables

-- Push subscriptions table (replaces storing in users.publicKey)
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `endpoint` TEXT NOT NULL,
  `p256dh` TEXT NOT NULL,
  `auth` TEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_push_subs_user` (`userId`),
  CONSTRAINT `fk_push_subs_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `expiresAt` TIMESTAMP NOT NULL,
  `usedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_prt_token` (`token`),
  INDEX `idx_prt_user` (`userId`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Account deletion tokens table
CREATE TABLE IF NOT EXISTS `account_deletion_tokens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `expiresAt` TIMESTAMP NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_adt_token` (`token`),
  CONSTRAINT `fk_adt_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Unique index on endorsements to prevent duplicates
CREATE UNIQUE INDEX `idx_endorsements_unique` ON `endorsements` (`userId`, `endorserId`, `endorsementType`);

-- Foreign key constraints on existing tables
ALTER TABLE `user_photos` ADD CONSTRAINT `fk_user_photos_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `matches` ADD CONSTRAINT `fk_matches_user1` FOREIGN KEY (`user1Id`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `matches` ADD CONSTRAINT `fk_matches_user2` FOREIGN KEY (`user2Id`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `swipes` ADD CONSTRAINT `fk_swipes_swiper` FOREIGN KEY (`swiperId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `swipes` ADD CONSTRAINT `fk_swipes_swiped` FOREIGN KEY (`swipedId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `conversation_participants` ADD CONSTRAINT `fk_cp_conversation` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE;
ALTER TABLE `conversation_participants` ADD CONSTRAINT `fk_cp_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_sender` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `court_reviews` ADD CONSTRAINT `fk_court_reviews_court` FOREIGN KEY (`courtId`) REFERENCES `courts`(`id`) ON DELETE CASCADE;
ALTER TABLE `court_reviews` ADD CONSTRAINT `fk_court_reviews_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `games` ADD CONSTRAINT `fk_games_organizer` FOREIGN KEY (`organizerId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `game_participants` ADD CONSTRAINT `fk_gp_game` FOREIGN KEY (`gameId`) REFERENCES `games`(`id`) ON DELETE CASCADE;
ALTER TABLE `game_participants` ADD CONSTRAINT `fk_gp_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `game_feedback` ADD CONSTRAINT `fk_gf_game` FOREIGN KEY (`gameId`) REFERENCES `games`(`id`) ON DELETE CASCADE;
ALTER TABLE `game_feedback` ADD CONSTRAINT `fk_gf_reviewer` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `game_feedback` ADD CONSTRAINT `fk_gf_reviewed` FOREIGN KEY (`reviewedId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `endorsements` ADD CONSTRAINT `fk_endorsements_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `endorsements` ADD CONSTRAINT `fk_endorsements_endorser` FOREIGN KEY (`endorserId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `user_achievements` ADD CONSTRAINT `fk_ua_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `user_achievements` ADD CONSTRAINT `fk_ua_achievement` FOREIGN KEY (`achievementId`) REFERENCES `achievements`(`id`) ON DELETE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notif_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `blocks` ADD CONSTRAINT `fk_blocks_blocker` FOREIGN KEY (`blockerId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `blocks` ADD CONSTRAINT `fk_blocks_blocked` FOREIGN KEY (`blockedId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `reports` ADD CONSTRAINT `fk_reports_reporter` FOREIGN KEY (`reporterId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `reports` ADD CONSTRAINT `fk_reports_reported` FOREIGN KEY (`reportedId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `group_members` ADD CONSTRAINT `fk_gm_group` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE;
ALTER TABLE `group_members` ADD CONSTRAINT `fk_gm_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `shared_coaching` ADD CONSTRAINT `fk_coaching_organizer` FOREIGN KEY (`organizerId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `coaching_participants` ADD CONSTRAINT `fk_coaching_p_coaching` FOREIGN KEY (`coachingId`) REFERENCES `shared_coaching`(`id`) ON DELETE CASCADE;
ALTER TABLE `coaching_participants` ADD CONSTRAINT `fk_coaching_p_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `coaching_reviews` ADD CONSTRAINT `fk_coaching_r_coaching` FOREIGN KEY (`coachingId`) REFERENCES `shared_coaching`(`id`) ON DELETE CASCADE;
ALTER TABLE `coaching_reviews` ADD CONSTRAINT `fk_coaching_r_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `quest_claims` ADD CONSTRAINT `fk_qc_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
