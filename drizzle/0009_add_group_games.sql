-- Add groupId column to games table to link games to groups
ALTER TABLE `games` ADD COLUMN `groupId` INT NULL AFTER `organizerId`;
CREATE INDEX `idx_games_group` ON `games` (`groupId`);
