-- Add structured location fields to shared_coaching table
ALTER TABLE `shared_coaching` ADD COLUMN `courtId` int DEFAULT NULL;
ALTER TABLE `shared_coaching` ADD COLUMN `locationLat` float DEFAULT NULL;
ALTER TABLE `shared_coaching` ADD COLUMN `locationLng` float DEFAULT NULL;
ALTER TABLE `shared_coaching` ADD COLUMN `locationName` varchar(255) DEFAULT NULL;
