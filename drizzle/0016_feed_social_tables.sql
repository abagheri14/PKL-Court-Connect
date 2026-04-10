-- Feed social tables: posts, comments, likes + update activity_feed enum

-- 1. Feed Posts (user-created social posts)
CREATE TABLE IF NOT EXISTS `feed_posts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `content` text NOT NULL,
  `photoUrl` text,
  `postType` enum('general','highlight','question','tip','looking_for_players') NOT NULL DEFAULT 'general',
  `likesCount` int NOT NULL DEFAULT 0,
  `commentsCount` int NOT NULL DEFAULT 0,
  `isPublic` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_fp2_user` (`userId`),
  INDEX `idx_fp2_type` (`postType`),
  INDEX `idx_fp2_created` (`createdAt`)
);

-- 2. Feed Comments
CREATE TABLE IF NOT EXISTS `feed_comments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `postId` int NOT NULL,
  `userId` int NOT NULL,
  `content` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_fc_post` (`postId`),
  INDEX `idx_fc_user` (`userId`)
);

-- 3. Feed Likes
CREATE TABLE IF NOT EXISTS `feed_likes` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `postId` int NOT NULL,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `idx_fl_unique` (`postId`, `userId`),
  INDEX `idx_fl_post` (`postId`)
);

-- 4. Add user_post to activity_feed activityType enum
ALTER TABLE `activity_feed` MODIFY COLUMN `activityType` enum('achievement_earned','game_completed','tournament_won','court_reviewed','level_up','streak_milestone','new_match','joined_group','coaching_completed','user_post') NOT NULL;
