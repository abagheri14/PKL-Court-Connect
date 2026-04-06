CREATE TABLE `achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`icon` varchar(255),
	`category` enum('social','games','profile','community') NOT NULL,
	`points` int NOT NULL DEFAULT 0,
	CONSTRAINT `achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','superadmin') NOT NULL,
	`permissions` text,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedBy` int,
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `archived_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalUserId` int NOT NULL,
	`profileSnapshot` text,
	`archivedAt` timestamp NOT NULL DEFAULT (now()),
	`deletionReason` text,
	CONSTRAINT `archived_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockerId` int NOT NULL,
	`blockedId` int NOT NULL,
	`blockedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	CONSTRAINT `blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coaching_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachingId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('confirmed','pending','cancelled') NOT NULL DEFAULT 'confirmed',
	CONSTRAINT `coaching_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `endorsements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endorserId` int NOT NULL,
	`endorsementType` enum('good-sport','on-time','accurate-rater','great-partner','skilled-player') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `endorsements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `game_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('confirmed','pending','declined') NOT NULL DEFAULT 'confirmed',
	`feedbackGiven` boolean NOT NULL DEFAULT false,
	CONSTRAINT `game_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizerId` int NOT NULL,
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
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','moderator','member') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `group_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderId` int NOT NULL,
	`encryptedContent` text,
	`messageType` enum('text','image','location_pin','system') NOT NULL DEFAULT 'text',
	`locationLat` float,
	`locationLng` float,
	`locationName` varchar(255),
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	`isDeleted` boolean NOT NULL DEFAULT false,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('match','message','game_invite','achievement','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`link` varchar(255),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_coaching_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`swiperId` int NOT NULL,
	`swipedId` int NOT NULL,
	`direction` enum('rally','pass') NOT NULL,
	`swipedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `swipes_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_swipes_pair` UNIQUE(`swiperId`,`swipedId`)
);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`achievementId` int NOT NULL,
	`earnedAt` timestamp,
	`progress` int NOT NULL DEFAULT 0,
	`maxProgress` int NOT NULL DEFAULT 1,
	CONSTRAINT `user_achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `skillRating` TO `skillLevel`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `skillLevel` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `dateOfBirth` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `age` int;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `publicKey` text;--> statement-breakpoint
ALTER TABLE `users` ADD `isVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `officialRating` float;--> statement-breakpoint
ALTER TABLE `users` ADD `ratingType` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `courtPreference` enum('indoor','outdoor','both') DEFAULT 'both';--> statement-breakpoint
ALTER TABLE `users` ADD `availabilityWeekdays` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `availabilityWeekends` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `availabilityMornings` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `availabilityAfternoons` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `availabilityEvenings` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `playFrequency` enum('once-month','once-week','2-3-week','daily');--> statement-breakpoint
ALTER TABLE `users` ADD `availability` text;--> statement-breakpoint
ALTER TABLE `users` ADD `locationUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `swipesUsedToday` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `maxDailySwipes` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `profileCompletion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `preferredFormat` text;--> statement-breakpoint
ALTER TABLE `users` ADD `freeCourtsOnly` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_cp_conversation` ON `conversation_participants` (`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_cp_user` ON `conversation_participants` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_court_reviews_court` ON `court_reviews` (`courtId`);--> statement-breakpoint
CREATE INDEX `idx_courts_location` ON `courts` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `idx_courts_city` ON `courts` (`city`);--> statement-breakpoint
CREATE INDEX `idx_courts_type` ON `courts` (`courtType`);--> statement-breakpoint
CREATE INDEX `idx_gp_game` ON `game_participants` (`gameId`);--> statement-breakpoint
CREATE INDEX `idx_gp_user` ON `game_participants` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_games_organizer` ON `games` (`organizerId`);--> statement-breakpoint
CREATE INDEX `idx_games_status` ON `games` (`status`);--> statement-breakpoint
CREATE INDEX `idx_games_schedule` ON `games` (`scheduledAt`);--> statement-breakpoint
CREATE INDEX `idx_matches_user1` ON `matches` (`user1Id`);--> statement-breakpoint
CREATE INDEX `idx_matches_user2` ON `matches` (`user2Id`);--> statement-breakpoint
CREATE INDEX `idx_matches_active` ON `matches` (`isActive`);--> statement-breakpoint
CREATE INDEX `idx_messages_conv` ON `messages` (`conversationId`,`sentAt`);--> statement-breakpoint
CREATE INDEX `idx_messages_sender` ON `messages` (`senderId`);--> statement-breakpoint
CREATE INDEX `idx_notif_user` ON `notifications` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `idx_swipes_swiper` ON `swipes` (`swiperId`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_location` ON `users` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_active` ON `users` (`isActive`,`isDeleted`);--> statement-breakpoint
CREATE INDEX `idx_users_skill` ON `users` (`skillLevel`);