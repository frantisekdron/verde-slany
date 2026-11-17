CREATE TABLE `library_folders` (
	`name` text PRIMARY KEY NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_placements` (
	`url` text PRIMARY KEY NOT NULL,
	`folder` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `media` ADD `folder` text DEFAULT 'Unfiled' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `removed_at` text DEFAULT '' NOT NULL;
