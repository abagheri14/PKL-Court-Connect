ALTER TABLE `game_results` ADD COLUMN `scoreConfirmedBy` text;
--> statement-breakpoint
ALTER TABLE `game_results` ADD COLUMN `scoreDisputed` boolean DEFAULT false;
