CREATE TABLE `upload_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`part_number` integer NOT NULL,
	`etag` text,
	`size` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`upload_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`file_size` integer NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
