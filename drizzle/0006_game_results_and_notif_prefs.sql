-- Game Results table
CREATE TABLE IF NOT EXISTS `game_results` (
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

-- Notification Preferences table
CREATE TABLE IF NOT EXISTS `notification_preferences` (
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
