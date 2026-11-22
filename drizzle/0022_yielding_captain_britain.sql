CREATE TABLE `planned_result_assignments` (
	`capture` text PRIMARY KEY NOT NULL,
	`users` text NOT NULL,
	`reversed` integer NOT NULL,
	FOREIGN KEY (`capture`) REFERENCES `webhook_captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `planned_result_assignments` (`capture`, `users`, `reversed`)
SELECT `id`, json_extract(`planned_users`, '$.users'), json_extract(`planned_users`, '$.reversed')
FROM `webhook_captures`
WHERE `planned_users` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `webhook_captures` DROP COLUMN `planned_users`;
