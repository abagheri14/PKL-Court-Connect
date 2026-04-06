-- Coaching enhancements: add agenda, planning, and notes columns
ALTER TABLE `shared_coaching` ADD COLUMN `agenda` text;
--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD COLUMN `focusAreas` text;
--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD COLUMN `drillPlan` text;
--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD COLUMN `sessionNotes` text;
--> statement-breakpoint
ALTER TABLE `shared_coaching` ADD COLUMN `equipmentNeeded` text;
