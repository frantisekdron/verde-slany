CREATE TABLE `mail_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`entity` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer NOT NULL,
	`created` text NOT NULL,
	`attempted` text NOT NULL,
	`lease_until` text NOT NULL,
	`provider_id` text NOT NULL,
	`error` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `news_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`published` text NOT NULL,
	`version` integer NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`recipients` text NOT NULL,
	`enabled` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`unit` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`note` text NOT NULL,
	`stage` text NOT NULL,
	`expires` text NOT NULL,
	`source` text NOT NULL,
	`request_key` text,
	`version` integer NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_cases_request_key_unique` ON `sales_cases` (`request_key`);--> statement-breakpoint
CREATE TABLE `sales_events` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`unit` text NOT NULL,
	`kind` text NOT NULL,
	`author` text NOT NULL,
	`detail` text NOT NULL,
	`created` text NOT NULL
);
