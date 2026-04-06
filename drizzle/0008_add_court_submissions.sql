CREATE TABLE IF NOT EXISTS `court_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submittedBy` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`latitude` float NOT NULL,
	`longitude` float NOT NULL,
	`city` varchar(100),
	`state` varchar(100),
	`courtType` enum('indoor','outdoor','both') NOT NULL DEFAULT 'outdoor',
	`numCourts` int NOT NULL DEFAULT 1,
	`surfaceType` varchar(50),
	`lighting` boolean NOT NULL DEFAULT false,
	`isFree` boolean NOT NULL DEFAULT true,
	`costInfo` text,
	`amenities` text,
	`photoUrl` text,
	`notes` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNotes` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `court_submissions_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_cs_status` ON `court_submissions` (`status`);
CREATE INDEX `idx_cs_submitter` ON `court_submissions` (`submittedBy`);
