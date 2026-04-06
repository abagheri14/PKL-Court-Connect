-- Feature gaps migration: court bookings, activity feed, message reactions,
-- court photos, rivalries, favorite players, referrals, video messages

-- 1. Court Bookings
CREATE TABLE IF NOT EXISTS `court_bookings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `courtId` int NOT NULL,
  `userId` int NOT NULL,
  `gameId` int,
  `startTime` timestamp NOT NULL,
  `endTime` timestamp NOT NULL,
  `courtNumber` int,
  `status` enum('confirmed','pending','cancelled') NOT NULL DEFAULT 'confirmed',
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cb_court` (`courtId`),
  INDEX `idx_cb_user` (`userId`),
  INDEX `idx_cb_time` (`courtId`, `startTime`, `endTime`)
);

-- 2. Activity Feed
CREATE TABLE IF NOT EXISTS `activity_feed` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `activityType` enum('achievement_earned','game_completed','tournament_won','court_reviewed','level_up','streak_milestone','new_match','joined_group','coaching_completed') NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `targetType` varchar(50),
  `targetId` int,
  `isPublic` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_af_user` (`userId`),
  INDEX `idx_af_type` (`activityType`),
  INDEX `idx_af_created` (`createdAt`)
);

-- 3. Message Reactions
CREATE TABLE IF NOT EXISTS `message_reactions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `messageId` int NOT NULL,
  `userId` int NOT NULL,
  `emoji` varchar(20) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_mr_message` (`messageId`),
  UNIQUE INDEX `idx_mr_unique` (`messageId`, `userId`, `emoji`)
);

-- 4. Court Photos
CREATE TABLE IF NOT EXISTS `court_photos` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `courtId` int NOT NULL,
  `userId` int NOT NULL,
  `photoUrl` text NOT NULL,
  `caption` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cp2_court` (`courtId`)
);

-- 5. Rivalries
CREATE TABLE IF NOT EXISTS `rivalries` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user1Id` int NOT NULL,
  `user2Id` int NOT NULL,
  `user1Wins` int NOT NULL DEFAULT 0,
  `user2Wins` int NOT NULL DEFAULT 0,
  `totalGames` int NOT NULL DEFAULT 0,
  `lastPlayedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `idx_rivalries_pair` (`user1Id`, `user2Id`),
  INDEX `idx_rivalries_user1` (`user1Id`),
  INDEX `idx_rivalries_user2` (`user2Id`)
);

-- 6. Favorite Players
CREATE TABLE IF NOT EXISTS `favorite_players` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `favoriteId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `idx_fp_unique` (`userId`, `favoriteId`),
  INDEX `idx_fp_user` (`userId`)
);

-- 7. Referrals
CREATE TABLE IF NOT EXISTS `referrals` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `referrerId` int NOT NULL,
  `referredId` int,
  `code` varchar(20) NOT NULL UNIQUE,
  `status` enum('pending','completed','expired') NOT NULL DEFAULT 'pending',
  `xpRewarded` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp,
  INDEX `idx_ref_referrer` (`referrerId`),
  UNIQUE INDEX `idx_ref_code` (`code`)
);

-- 8. Add video to messages messageType enum
ALTER TABLE `messages` MODIFY COLUMN `messageType` enum('text','image','video','location_pin','system') NOT NULL DEFAULT 'text';
