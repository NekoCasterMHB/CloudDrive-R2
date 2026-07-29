CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`filename` text NOT NULL,
	`object_key` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`etag` text,
	`thumbnail_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
