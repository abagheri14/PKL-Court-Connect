-- ══════════════════════════════════════════════════════════════════════════════
-- PKL Court Connect — Complete Database Schema
-- ══════════════════════════════════════════════════════════════════════════════
-- This file contains ALL migrations consolidated into a single file.
-- Run this against a fresh MySQL 8.x database to set up the complete schema.
--
-- Usage:
--   mysql -u root -p pkl_court_connect < database/init.sql
--
-- Or from MySQL client:
--   SOURCE /path/to/init.sql
--
-- Prerequisites:
--   CREATE DATABASE pkl_court_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Migration 0000: Core Users Table                                           │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`nickname` varchar(50),
	`showFullName` boolean NOT NULL DEFAULT false,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user',
	`gender` enum('male','female','non-binary','prefer-not-to-say'),
	`hasProfilePhoto` boolean NOT NULL DEFAULT false,
	`profilePhotoUrl` text,
	`bio` text,
	`skillLevel` varchar(20),
	`isRatingVerified` boolean NOT NULL DEFAULT false,
	`isPhotoVerified` boolean NOT NULL DEFAULT false,
	`vibe` enum('competitive','social','both') DEFAULT 'both',
	`pace` enum('fast','rally','both') DEFAULT 'both',
	`playStyle` text,
	`handedness` enum('left','right','ambidextrous') DEFAULT 'right',
	`goals` text,
	`latitude` float,
	`longitude` float,
	`city` varchar(100),
	`region` varchar(100),
	`xp` int NOT NULL DEFAULT 0,
	`level` int NOT NULL DEFAULT 1,
	`currentStreak` int NOT NULL DEFAULT 0,
	`longestStreak` int NOT NULL DEFAULT 0,
	`lastLoginDate` timestamp,
	`isPremium` boolean NOT NULL DEFAULT false,
	`premiumUntil` timestamp,
	`totalGames` int NOT NULL DEFAULT 0,
	`totalMatches` int NOT NULL DEFAULT 0,
	`averageRating` float NOT NULL DEFAULT 0,
	`ageMin` int,
	`ageMax` int,
	`genderPreference` text,
	`skillRatingMin` float,
	`skillRatingMax` float,
	`maxDistance` int NOT NULL DEFAULT 25,
	`isDeleted` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	`username` varchar(50),
	`passwordHash` varchar(255),
	`dateOfBirth` timestamp,
	`age` int,
	`phone` varchar(20),
	`publicKey` text,
	`isVerified` boolean DEFAULT false NOT NULL,
	`isActive` boolean DEFAULT true NOT NULL,
	`officialRating` float,
	`ratingType` varchar(50),
	`courtPreference` enum('indoor','outdoor','both') DEFAULT 'both',
	`availabilityWeekdays` boolean DEFAULT true NOT NULL,
	`availabilityWeekends` boolean DEFAULT true NOT NULL,
	`availabilityMornings` boolean DEFAULT true NOT NULL,
	`availabilityAfternoons` boolean DEFAULT true NOT NULL,
	`availabilityEvenings` boolean DEFAULT true NOT NULL,
	`playFrequency` enum('once-month','once-week','2-3-week','daily'),
	`availability` text,
	`locationUpdatedAt` timestamp,
	`swipesUsedToday` int DEFAULT 0 NOT NULL,
	`maxDailySwipes` int DEFAULT 10 NOT NULL,
	`profileCompletion` int DEFAULT 0 NOT NULL,
	`onboardingCompleted` boolean DEFAULT false NOT NULL,
	`preferredFormat` text,
	`freeCourtsOnly` boolean DEFAULT false NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Migration 0001: Core App Tables                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE `achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`icon` varchar(255),
	`category` enum('social','games','profile','community') NOT NULL,
	`points` int NOT NULL DEFAULT 0,
	`requirementType` varchar(50),
	`requirementValue` int DEFAULT 1,
	CONSTRAINT `achievements_id` PRIMARY KEY(`id`)
);

CREATE TABLE `admin_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','superadmin') NOT NULL,
	`permissions` text,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedBy` int,
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`)
);

CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);

CREATE TABLE `archived_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalUserId` int NOT NULL,
	`profileSnapshot` text,
	`archivedAt` timestamp NOT NULL DEFAULT (now()),
	`deletionReason` text,
	CONSTRAINT `archived_users_id` PRIMARY KEY(`id`)
);

CREATE TABLE `blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockerId` int NOT NULL,
	`blockedId` int NOT NULL,
	`blockedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	CONSTRAINT `blocks_id` PRIMARY KEY(`id`)
);

CREATE TABLE `coaching_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachingId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('confirmed','pending','cancelled') NOT NULL DEFAULT 'confirmed',
	`attended` boolean DEFAULT false NOT NULL,
	CONSTRAINT `coaching_participants_id` PRIMARY KEY(`id`)
);

CREATE TABLE `conversation_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`leftAt` timestamp,
	`isAdmin` boolean NOT NULL DEFAULT false,
	`lastReadAt` timestamp,
	CONSTRAINT `conversation_participants_id` PRIMARY KEY(`id`)
);

CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('direct','group') NOT NULL DEFAULT 'direct',
	`name` varchar(100),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastMessageAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `court_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courtId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`photos` text,
	`helpfulCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `court_reviews_id` PRIMARY KEY(`id`)
);

CREATE TABLE `courts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`latitude` float NOT NULL,
	`longitude` float NOT NULL,
	`city` varchar(100),
	`state` varchar(100),
	`country` varchar(100) DEFAULT 'US',
	`courtType` enum('indoor','outdoor','both') NOT NULL DEFAULT 'outdoor',
	`numCourts` int NOT NULL DEFAULT 1,
	`surfaceType` varchar(50),
	`lighting` boolean NOT NULL DEFAULT false,
	`isFree` boolean NOT NULL DEFAULT true,
	`costInfo` text,
	`amenities` text,
	`addedBy` int,
	`isVerified` boolean NOT NULL DEFAULT false,
	`averageRating` float NOT NULL DEFAULT 0,
	`totalReviews` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `courts_id` PRIMARY KEY(`id`)
);

CREATE TABLE `endorsements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endorserId` int NOT NULL,
	`endorsementType` enum('good-sport','on-time','accurate-rater','great-partner','skilled-player') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `endorsements_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_endorsements_unique` UNIQUE(`userId`,`endorserId`,`endorsementType`)
);

CREATE TABLE `game_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`reviewedId` int NOT NULL,
	`rating` int NOT NULL,
	`skillAccurate` boolean NOT NULL DEFAULT true,
	`goodSport` boolean NOT NULL DEFAULT true,
	`onTime` boolean NOT NULL DEFAULT true,
	`wouldPlayAgain` boolean NOT NULL DEFAULT true,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_feedback_id` PRIMARY KEY(`id`)
);

CREATE TABLE `game_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('confirmed','pending','declined') NOT NULL DEFAULT 'confirmed',
	`feedbackGiven` boolean NOT NULL DEFAULT false,
	CONSTRAINT `game_participants_id` PRIMARY KEY(`id`)
);

CREATE TABLE `games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizerId` int NOT NULL,
	`groupId` int,
	`courtId` int,
	`locationLat` float,
	`locationLng` float,
	`locationName` varchar(255),
	`scheduledAt` timestamp NOT NULL,
	`durationMinutes` int NOT NULL DEFAULT 90,
	`gameType` enum('casual','competitive','tournament','practice') NOT NULL DEFAULT 'casual',
	`format` enum('singles','mens-doubles','womens-doubles','mixed-doubles') NOT NULL DEFAULT 'mixed-doubles',
	`maxPlayers` int NOT NULL DEFAULT 4,
	`skillLevelMin` varchar(10),
	`skillLevelMax` varchar(10),
	`isOpen` boolean NOT NULL DEFAULT true,
	`notes` text,
	`status` enum('scheduled','in-progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `games_id` PRIMARY KEY(`id`)
);

CREATE TABLE `group_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','moderator','member') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `group_members_id` PRIMARY KEY(`id`)
);

CREATE TABLE `groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`groupType` enum('social','league','tournament','coaching') NOT NULL DEFAULT 'social',
	`isPrivate` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`memberCount` int NOT NULL DEFAULT 0,
	`locationCity` varchar(100),
	`photo` text,
	`conversationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `groups_id` PRIMARY KEY(`id`)
);

CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user1Id` int NOT NULL,
	`user2Id` int NOT NULL,
	`matchedAt` timestamp NOT NULL DEFAULT (now()),
	`isActive` boolean NOT NULL DEFAULT true,
	`unmatchedBy` int,
	`unmatchedAt` timestamp,
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);

CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderId` int NOT NULL,
	`content` text,
	`messageType` enum('text','image','video','location_pin','system') NOT NULL DEFAULT 'text',
	`locationLat` float,
	`locationLng` float,
	`locationName` varchar(255),
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	`isDeleted` boolean NOT NULL DEFAULT false,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);

CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('match','message','game_invite','achievement','system','tournament_invite') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`link` varchar(255),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);

CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterId` int NOT NULL,
	`reportedId` int NOT NULL,
	`reportType` enum('inappropriate','fake-profile','harassment','safety','other') NOT NULL,
	`description` text,
	`status` enum('pending','reviewed','action-taken','dismissed') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);

CREATE TABLE `shared_coaching` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`coachName` varchar(100),
	`location` varchar(255),
	`scheduledAt` timestamp NOT NULL,
	`durationMinutes` int NOT NULL DEFAULT 60,
	`maxParticipants` int NOT NULL DEFAULT 10,
	`costPerPerson` float,
	`skillLevel` varchar(50),
	`status` enum('open','full','completed','cancelled') NOT NULL DEFAULT 'open',
	`agenda` text,
	`focusAreas` text,
	`drillPlan` text,
	`sessionNotes` text,
	`equipmentNeeded` text,
	`courtId` int DEFAULT NULL,
	`locationLat` float DEFAULT NULL,
	`locationLng` float DEFAULT NULL,
	`locationName` varchar(255) DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_coaching_id` PRIMARY KEY(`id`)
);

CREATE TABLE `swipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`swiperId` int NOT NULL,
	`swipedId` int NOT NULL,
	`direction` enum('rally','pass') NOT NULL,
	`isSuperRally` boolean NOT NULL DEFAULT false,
	`swipedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `swipes_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_swipes_pair` UNIQUE(`swiperId`,`swipedId`)
);

CREATE TABLE `user_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`achievementId` int NOT NULL,
	`earnedAt` timestamp,
	`progress` int NOT NULL DEFAULT 0,
	`maxProgress` int NOT NULL DEFAULT 1,
	CONSTRAINT `user_achievements_id` PRIMARY KEY(`id`)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Migration 0004+: Additional Tables                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE `account_deletion_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_deletion_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_deletion_tokens_token_unique` UNIQUE(`token`)
);

CREATE TABLE `coaching_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachingId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coaching_reviews_id` PRIMARY KEY(`id`)
);

CREATE TABLE `game_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`winnerTeam` enum('team1','team2','draw'),
	`team1Score` int NOT NULL,
	`team2Score` int NOT NULL,
	`team1PlayerIds` text,
	`team2PlayerIds` text,
	`recordedBy` int NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`scoreConfirmedBy` text,
	`scoreDisputed` boolean DEFAULT false,
	CONSTRAINT `game_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_game_results_game` UNIQUE(`gameId`)
);

CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`matchNotif` boolean NOT NULL DEFAULT true,
	`messageNotif` boolean NOT NULL DEFAULT true,
	`gameInviteNotif` boolean NOT NULL DEFAULT true,
	`achievementNotif` boolean NOT NULL DEFAULT true,
	`systemNotif` boolean NOT NULL DEFAULT true,
	`pushEnabled` boolean NOT NULL DEFAULT true,
	`emailEnabled` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_notif_prefs_user` UNIQUE(`userId`)
);

CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
);

CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `quest_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questId` varchar(100) NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quest_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_quest_claims_user_quest` UNIQUE(`userId`,`questId`,`claimedAt`)
);

CREATE TABLE `user_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`photoUrl` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_photos_id` PRIMARY KEY(`id`)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Migration 0007: Challenges                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE `challenges` (
  `id` int AUTO_INCREMENT NOT NULL,
  `challengerId` int NOT NULL,
  `challengedId` int NOT NULL,
  `gameType` enum('casual','competitive','tournament','practice') NOT NULL DEFAULT 'casual',
  `format` enum('singles','mens-doubles','womens-doubles','mixed-doubles') NOT NULL DEFAULT 'singles',
  `message` text,
  `status` enum('pending','accepted','declined','expired') NOT NULL DEFAULT 'pending',
  `gameId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `respondedAt` timestamp,
  CONSTRAINT `challenges_id` PRIMARY KEY(`id`)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Migration 0008: Court Submissions                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE `court_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submittedBy` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`latitude` float NOT NULL,
	`longitude` float NOT NULL,
	`city` varchar(100),
	`state` varchar(100),
	`courtType` enum('indoor','outdoor','both') NOT NULL DEFAULT 'outdoor',
	`numCourts` int NOT NULL DEFAULT 1,
	`surfaceType` varchar(50),
	`lighting` boolean NOT NULL DEFAULT false,
	`isFree` boolean NOT NULL DEFAULT true,
	`costInfo` text,
	`amenities` text,
	`photoUrl` text,
	`notes` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNotes` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `court_submissions_id` PRIMARY KEY(`id`)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Migration 0011: Feature Gap Tables                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Court Bookings
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
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Activity Feed
CREATE TABLE IF NOT EXISTS `activity_feed` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `activityType` enum('achievement_earned','game_completed','tournament_won','court_reviewed','level_up','streak_milestone','new_match','joined_group','coaching_completed','user_post') NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `targetType` varchar(50),
  `targetId` int,
  `isPublic` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Message Reactions
CREATE TABLE IF NOT EXISTS `message_reactions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `messageId` int NOT NULL,
  `userId` int NOT NULL,
  `emoji` varchar(20) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `idx_mr_unique` (`messageId`, `userId`, `emoji`)
);

-- Court Photos
CREATE TABLE IF NOT EXISTS `court_photos` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `courtId` int NOT NULL,
  `userId` int NOT NULL,
  `photoUrl` text NOT NULL,
  `caption` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rivalries
CREATE TABLE IF NOT EXISTS `rivalries` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user1Id` int NOT NULL,
  `user2Id` int NOT NULL,
  `user1Wins` int NOT NULL DEFAULT 0,
  `user2Wins` int NOT NULL DEFAULT 0,
  `totalGames` int NOT NULL DEFAULT 0,
  `lastPlayedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `idx_rivalries_pair` (`user1Id`, `user2Id`)
);

-- Favorite Players
CREATE TABLE IF NOT EXISTS `favorite_players` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `favoriteId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `idx_fp_unique` (`userId`, `favoriteId`)
);

-- Referrals
CREATE TABLE IF NOT EXISTS `referrals` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `referrerId` int NOT NULL,
  `referredId` int,
  `code` varchar(20) NOT NULL UNIQUE,
  `status` enum('pending','completed','expired') NOT NULL DEFAULT 'pending',
  `xpRewarded` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp,
  UNIQUE INDEX `idx_ref_code` (`code`)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Migration 0012: Feed Social Tables                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Feed Posts (user-created social posts)
CREATE TABLE IF NOT EXISTS `feed_posts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `content` text NOT NULL,
  `photoUrl` text,
  `postType` enum('general','highlight','question','tip','looking_for_players') NOT NULL DEFAULT 'general',
  `likesCount` int NOT NULL DEFAULT 0,
  `commentsCount` int NOT NULL DEFAULT 0,
  `isPublic` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Feed Comments
CREATE TABLE IF NOT EXISTS `feed_comments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `postId` int NOT NULL,
  `userId` int NOT NULL,
  `content` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Feed Likes
CREATE TABLE IF NOT EXISTS `feed_likes` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `postId` int NOT NULL,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `idx_fl_unique` (`postId`, `userId`)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Indexes                                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Users
CREATE INDEX `idx_users_email` ON `users` (`email`);
CREATE INDEX `idx_users_username` ON `users` (`username`);
CREATE INDEX `idx_users_role` ON `users` (`role`);
CREATE INDEX `idx_users_location` ON `users` (`latitude`,`longitude`);
CREATE INDEX `idx_users_active` ON `users` (`isActive`,`isDeleted`);
CREATE INDEX `idx_users_skill` ON `users` (`skillLevel`);

-- Conversation Participants
CREATE INDEX `idx_cp_conversation` ON `conversation_participants` (`conversationId`);
CREATE INDEX `idx_cp_user` ON `conversation_participants` (`userId`);

-- Court Reviews
CREATE INDEX `idx_court_reviews_court` ON `court_reviews` (`courtId`);
CREATE INDEX `idx_court_reviews_user` ON `court_reviews` (`userId`);

-- Courts
CREATE INDEX `idx_courts_location` ON `courts` (`latitude`,`longitude`);
CREATE INDEX `idx_courts_city` ON `courts` (`city`);
CREATE INDEX `idx_courts_type` ON `courts` (`courtType`);

-- Game Participants
CREATE INDEX `idx_gp_game` ON `game_participants` (`gameId`);
CREATE INDEX `idx_gp_user` ON `game_participants` (`userId`);

-- Games
CREATE INDEX `idx_games_organizer` ON `games` (`organizerId`);
CREATE INDEX `idx_games_status` ON `games` (`status`);
CREATE INDEX `idx_games_schedule` ON `games` (`scheduledAt`);
CREATE INDEX `idx_games_court` ON `games` (`courtId`);
CREATE INDEX `idx_games_group` ON `games` (`groupId`);

-- Matches
CREATE INDEX `idx_matches_user1` ON `matches` (`user1Id`);
CREATE INDEX `idx_matches_user2` ON `matches` (`user2Id`);
CREATE INDEX `idx_matches_active` ON `matches` (`isActive`);

-- Messages
CREATE INDEX `idx_messages_conv` ON `messages` (`conversationId`,`sentAt`);
CREATE INDEX `idx_messages_sender` ON `messages` (`senderId`);

-- Notifications
CREATE INDEX `idx_notif_user` ON `notifications` (`userId`,`isRead`);
CREATE INDEX `idx_notifications_created` ON `notifications` (`createdAt`);

-- Swipes
CREATE INDEX `idx_swipes_swiper` ON `swipes` (`swiperId`);
CREATE INDEX `idx_swipes_swiped` ON `swipes` (`swipedId`);

-- Endorsements
CREATE INDEX `idx_endorsements_user` ON `endorsements` (`userId`);
CREATE INDEX `idx_endorsements_endorser` ON `endorsements` (`endorserId`);

-- User Achievements
CREATE INDEX `idx_user_achievements_user` ON `user_achievements` (`userId`);

-- Reports
CREATE INDEX `idx_reports_status` ON `reports` (`status`);
CREATE INDEX `idx_reports_reporter` ON `reports` (`reporterId`);

-- Blocks
CREATE INDEX `idx_blocks_blocker` ON `blocks` (`blockerId`);
CREATE INDEX `idx_blocks_blocked` ON `blocks` (`blockedId`);

-- Group Members
CREATE INDEX `idx_group_members_user` ON `group_members` (`userId`);
CREATE INDEX `idx_group_members_group` ON `group_members` (`groupId`);

-- Game Feedback
CREATE INDEX `idx_game_feedback_game` ON `game_feedback` (`gameId`);
CREATE INDEX `idx_game_feedback_reviewer` ON `game_feedback` (`reviewerId`);

-- Coaching
CREATE INDEX `idx_coaching_status` ON `shared_coaching` (`status`);
CREATE INDEX `idx_coaching_scheduled` ON `shared_coaching` (`scheduledAt`);
CREATE INDEX `idx_coaching_organizer` ON `shared_coaching` (`organizerId`);
CREATE INDEX `idx_coaching_participants_coaching` ON `coaching_participants` (`coachingId`);
CREATE INDEX `idx_coaching_participants_user` ON `coaching_participants` (`userId`);
CREATE INDEX `idx_coaching_participants_status` ON `coaching_participants` (`status`);

-- Account/Password Tokens
CREATE INDEX `idx_adt_token` ON `account_deletion_tokens` (`token`);
CREATE INDEX `idx_prt_token` ON `password_reset_tokens` (`token`);
CREATE INDEX `idx_prt_user` ON `password_reset_tokens` (`userId`);

-- Push Subscriptions
CREATE INDEX `idx_push_subs_user` ON `push_subscriptions` (`userId`);

-- User Photos
CREATE INDEX `idx_user_photos_user` ON `user_photos` (`userId`);

-- Challenges
CREATE INDEX `idx_challenges_challenger` ON `challenges` (`challengerId`);
CREATE INDEX `idx_challenges_challenged` ON `challenges` (`challengedId`);
CREATE INDEX `idx_challenges_status` ON `challenges` (`status`);

-- Court Submissions
CREATE INDEX `idx_cs_status` ON `court_submissions` (`status`);
CREATE INDEX `idx_cs_submitter` ON `court_submissions` (`submittedBy`);

-- Court Bookings
CREATE INDEX `idx_cb_court` ON `court_bookings` (`courtId`);
CREATE INDEX `idx_cb_user` ON `court_bookings` (`userId`);
CREATE INDEX `idx_cb_time` ON `court_bookings` (`courtId`, `startTime`, `endTime`);

-- Activity Feed
CREATE INDEX `idx_af_user` ON `activity_feed` (`userId`);
CREATE INDEX `idx_af_type` ON `activity_feed` (`activityType`);
CREATE INDEX `idx_af_created` ON `activity_feed` (`createdAt`);

-- Message Reactions
CREATE INDEX `idx_mr_message` ON `message_reactions` (`messageId`);

-- Court Photos
CREATE INDEX `idx_cp2_court` ON `court_photos` (`courtId`);

-- Rivalries
CREATE INDEX `idx_rivalries_user1` ON `rivalries` (`user1Id`);
CREATE INDEX `idx_rivalries_user2` ON `rivalries` (`user2Id`);

-- Favorite Players
CREATE INDEX `idx_fp_user` ON `favorite_players` (`userId`);

-- Referrals
CREATE INDEX `idx_ref_referrer` ON `referrals` (`referrerId`);

-- Feed Posts
CREATE INDEX `idx_fp2_user` ON `feed_posts` (`userId`);
CREATE INDEX `idx_fp2_type` ON `feed_posts` (`postType`);
CREATE INDEX `idx_fp2_created` ON `feed_posts` (`createdAt`);

-- Feed Comments
CREATE INDEX `idx_fc_post` ON `feed_comments` (`postId`);
CREATE INDEX `idx_fc_user` ON `feed_comments` (`userId`);

-- Feed Likes
CREATE INDEX `idx_fl_post` ON `feed_likes` (`postId`);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Foreign Key Constraints                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE `push_subscriptions` ADD CONSTRAINT `fk_push_subs_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `fk_prt_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `account_deletion_tokens` ADD CONSTRAINT `fk_adt_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
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

-- ══════════════════════════════════════════════════════════════════════════════
-- Schema initialization complete!
-- The app will automatically seed achievements, courts, and test data on startup.
-- ══════════════════════════════════════════════════════════════════════════════
