CREATE TABLE `platform_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`streamer_id` text NOT NULL,
	`platform` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`platform_username` text,
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` integer,
	`connected_at` integer NOT NULL,
	FOREIGN KEY (`streamer_id`) REFERENCES `streamer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `streamer` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `streamling` (
	`id` text PRIMARY KEY NOT NULL,
	`streamer_id` text NOT NULL,
	`durable_object_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`streamer_id`) REFERENCES `streamer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streamling_streamer_id_unique` ON `streamling` (`streamer_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`age` integer
);
