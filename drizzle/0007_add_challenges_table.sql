-- Challenges table (player-to-player challenge system)
CREATE TABLE IF NOT EXISTS `challenges` (
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

CREATE INDEX `idx_challenges_challenger` ON `challenges` (`challengerId`);
CREATE INDEX `idx_challenges_challenged` ON `challenges` (`challengedId`);
CREATE INDEX `idx_challenges_status` ON `challenges` (`status`);
