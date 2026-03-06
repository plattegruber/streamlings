ALTER TABLE `streamling` ADD `character_type` text DEFAULT 'default-3d' NOT NULL;--> statement-breakpoint
UPDATE `streamling` SET `character_type` = 'plant';