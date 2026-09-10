CREATE TABLE `library_favorites` (
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`library_id` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `library_id`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "library_favorites_user_id_check" CHECK(length(trim("library_favorites"."user_id")) > 0)
);
--> statement-breakpoint
CREATE INDEX `library_favorites_library_id_idx` ON `library_favorites` (`library_id`);