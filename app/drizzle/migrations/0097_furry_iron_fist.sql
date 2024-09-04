ALTER TABLE `UserData` MODIFY COLUMN `isBanned` boolean NOT NULL;
ALTER TABLE `UserData` MODIFY COLUMN `isBanned` boolean NOT NULL DEFAULT false;
ALTER TABLE `UserReport` MODIFY COLUMN `status` enum('UNVIEWED','REPORT_CLEARED','BAN_ACTIVATED','SILENCE_ACTIVATED','BAN_ESCALATED','SILENCE_ESCALATED') NOT NULL DEFAULT 'UNVIEWED';
ALTER TABLE `UserReportComment` MODIFY COLUMN `decision` enum('UNVIEWED','REPORT_CLEARED','BAN_ACTIVATED','SILENCE_ACTIVATED','BAN_ESCALATED','SILENCE_ESCALATED');
ALTER TABLE `UserData` ADD `isSilenced` boolean DEFAULT false NOT NULL;