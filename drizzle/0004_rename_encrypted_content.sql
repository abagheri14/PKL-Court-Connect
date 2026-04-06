-- Rename misleading encryptedContent column to content (stores plaintext)
ALTER TABLE `messages` CHANGE COLUMN `encryptedContent` `content` TEXT;
