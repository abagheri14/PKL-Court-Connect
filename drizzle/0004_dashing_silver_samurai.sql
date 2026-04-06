CREATE TABLE `account_deletion_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_deletion_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_deletion_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `coaching_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachingId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coaching_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
	CONSTRAINT `game_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_game_results_game` UNIQUE(`gameId`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quest_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questId` varchar(100) NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quest_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_quest_claims_user_quest` UNIQUE(`userId`,`questId`,`claimedAt`)
);
--> statement-breakpoint
CREATE TABLE `user_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`photoUrl` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `achievements` ADD `requirementType` varchar(50);--> statement-breakpoint
ALTER TABLE `achievements` ADD `requirementValue` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `coaching_participants` ADD `attended` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `conversationId` int;--> statement-breakpoint
ALTER TABLE `messages` ADD `content` text;--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD `agenda` text;--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD `focusAreas` text;--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD `drillPlan` text;--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD `sessionNotes` text;--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD `equipmentNeeded` text;--> statement-breakpoint
ALTER TABLE `endorsements` ADD CONSTRAINT `idx_endorsements_unique` UNIQUE(`userId`,`endorserId`,`endorsementType`);--> statement-breakpoint
CREATE INDEX `idx_adt_token` ON `account_deletion_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_prt_token` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_prt_user` ON `password_reset_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_push_subs_user` ON `push_subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_user_photos_user` ON `user_photos` (`userId`);--> statement-breakpoint
ALTER TABLE `messages` DROP COLUMN `encryptedContent`;