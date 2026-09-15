CREATE TABLE `library_likes` (
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`library_id` integer NOT NULL,
	`visitor_id` text NOT NULL,
	PRIMARY KEY(`visitor_id`, `library_id`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "library_likes_visitor_id_check" CHECK(length(trim("library_likes"."visitor_id")) > 0)
);
--> statement-breakpoint
CREATE INDEX `library_likes_library_id_idx` ON `library_likes` (`library_id`);