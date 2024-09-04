CREATE TABLE `ActionLog` (
	`id` varchar(191) PRIMARY KEY NOT NULL,
	`userId` varchar(191),
	`createdAt` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`tableName` varchar(191),
	`changes` json NOT NULL);

ALTER TABLE `Item` MODIFY COLUMN `weaponType` enum('STAFF','AXE','FIST_WEAPON','SHURIKEN','SICKLE','DAGGER','SWORD','POLEARM','FLAIL','CHAIN','FAN','BOW','HAMMER','NONE') NOT NULL DEFAULT 'NONE';
ALTER TABLE `Jutsu` MODIFY COLUMN `jutsuWeapon` enum('STAFF','AXE','FIST_WEAPON','SHURIKEN','SICKLE','DAGGER','SWORD','POLEARM','FLAIL','CHAIN','FAN','BOW','HAMMER','NONE') NOT NULL DEFAULT 'NONE';
CREATE INDEX `ActionLog_userId_idx` ON `ActionLog` (`userId`);