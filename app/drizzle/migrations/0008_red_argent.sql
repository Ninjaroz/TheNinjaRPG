ALTER TABLE `UserData` MODIFY COLUMN `status` enum('AWAKE','HOSPITALIZED','TRAVEL','BATTLE','ASLEEP') NOT NULL DEFAULT 'AWAKE';
ALTER TABLE `UserData` ADD `pvpFights` int DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `pveFights` int DEFAULT 0 NOT NULL;