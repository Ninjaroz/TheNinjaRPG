ALTER TABLE `UsersInConversation` DROP PRIMARY KEY;
ALTER TABLE `UserData` MODIFY COLUMN `curHealth` smallint unsigned NOT NULL DEFAULT 100;
ALTER TABLE `UserData` MODIFY COLUMN `maxHealth` smallint unsigned NOT NULL DEFAULT 100;
ALTER TABLE `UserData` MODIFY COLUMN `curChakra` smallint unsigned NOT NULL DEFAULT 100;
ALTER TABLE `UserData` MODIFY COLUMN `maxChakra` smallint unsigned NOT NULL DEFAULT 100;
ALTER TABLE `UserData` MODIFY COLUMN `curStamina` smallint unsigned NOT NULL DEFAULT 100;
ALTER TABLE `UserData` MODIFY COLUMN `maxStamina` smallint unsigned NOT NULL DEFAULT 100;
ALTER TABLE `UserData` MODIFY COLUMN `regeneration` tinyint unsigned NOT NULL DEFAULT 1;
ALTER TABLE `UserData` MODIFY COLUMN `level` tinyint unsigned NOT NULL DEFAULT 1;
ALTER TABLE `UserData` MODIFY COLUMN `sector` smallint unsigned NOT NULL;
ALTER TABLE `UserData` MODIFY COLUMN `longitude` tinyint unsigned NOT NULL DEFAULT 10;
ALTER TABLE `UserData` MODIFY COLUMN `latitude` tinyint unsigned NOT NULL DEFAULT 7;
ALTER TABLE `UserData` MODIFY COLUMN `eloPve` smallint unsigned NOT NULL DEFAULT 1;
ALTER TABLE `UserData` MODIFY COLUMN `eloPvp` smallint unsigned NOT NULL DEFAULT 1;
ALTER TABLE `UserData` MODIFY COLUMN `pvpStreak` smallint unsigned NOT NULL;
ALTER TABLE `UserData` MODIFY COLUMN `curEnergy` tinyint unsigned NOT NULL DEFAULT 100;
ALTER TABLE `UserData` MODIFY COLUMN `maxEnergy` tinyint unsigned NOT NULL DEFAULT 100;
ALTER TABLE `UserData` MODIFY COLUMN `unreadNotifications` tinyint unsigned NOT NULL;
ALTER TABLE `UserData` MODIFY COLUMN `unreadNews` tinyint unsigned NOT NULL;
ALTER TABLE `UsersInConversation` ADD PRIMARY KEY(`conversationId`,`userId`);
ALTER TABLE `UserData` ADD `errands` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `missionsD` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `missionsC` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `missionsB` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `missionsA` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `missionsS` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `crimesD` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `crimesC` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `crimesB` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `crimesA` smallint unsigned DEFAULT 0 NOT NULL;
ALTER TABLE `UserData` ADD `crimesS` smallint unsigned DEFAULT 0 NOT NULL;