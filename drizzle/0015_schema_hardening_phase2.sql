-- Schema hardening phase 2: column types, constraints, new fields
-- Safe for live testing environment

-- 1. gameResults: convert text columns to JSON for proper array storage
ALTER TABLE `game_results` MODIFY COLUMN `team1PlayerIds` JSON DEFAULT NULL;
ALTER TABLE `game_results` MODIFY COLUMN `team2PlayerIds` JSON DEFAULT NULL;
ALTER TABLE `game_results` MODIFY COLUMN `scoreConfirmedBy` JSON DEFAULT NULL;

-- 2. messages: add edit-tracking fields
ALTER TABLE `messages` ADD COLUMN `isEdited` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `messages` ADD COLUMN `editedAt` TIMESTAMP NULL DEFAULT NULL;

-- 3. users.username: add unique constraint (allows nulls in MySQL)
ALTER TABLE `users` ADD UNIQUE INDEX `idx_users_username_unique` (`username`);

-- 4. challenges.durationMinutes: make NOT NULL with default
ALTER TABLE `challenges` MODIFY COLUMN `durationMinutes` INT NOT NULL DEFAULT 90;
