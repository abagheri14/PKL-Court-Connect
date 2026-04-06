-- Add 'tournament_invite' to the notification type enum
ALTER TABLE `notifications` MODIFY COLUMN `type` ENUM('match', 'message', 'game_invite', 'achievement', 'system', 'tournament_invite') NOT NULL;
