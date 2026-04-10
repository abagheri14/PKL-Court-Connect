-- Feed reactions (emoji reactions on posts)
CREATE TABLE IF NOT EXISTS `feed_reactions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `postId` int NOT NULL,
  `userId` int NOT NULL,
  `emoji` varchar(16) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `feed_reactions_id` PRIMARY KEY(`id`),
  CONSTRAINT `idx_fr_unique` UNIQUE(`postId`, `userId`, `emoji`)
);
CREATE INDEX `idx_fr_post` ON `feed_reactions` (`postId`);

-- Feed bookmarks (saved posts)
CREATE TABLE IF NOT EXISTS `feed_bookmarks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `postId` int NOT NULL,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `feed_bookmarks_id` PRIMARY KEY(`id`),
  CONSTRAINT `idx_fb_unique` UNIQUE(`postId`, `userId`)
);
CREATE INDEX `idx_fb_user` ON `feed_bookmarks` (`userId`);
