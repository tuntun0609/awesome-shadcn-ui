ALTER TABLE `github_metrics` RENAME TO `repository_metrics`;--> statement-breakpoint
ALTER TABLE `libraries` RENAME COLUMN "github" TO "repository_url";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_repository_metrics` (
	`latest_commit_at` text,
	`library_id` integer PRIMARY KEY NOT NULL,
	`stars` integer NOT NULL,
	`synced_at` text NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "repository_metrics_stars_check" CHECK("__new_repository_metrics"."stars" >= 0),
	CONSTRAINT "repository_metrics_latest_commit_at_check" CHECK("__new_repository_metrics"."latest_commit_at" is null or datetime("__new_repository_metrics"."latest_commit_at") is not null),
	CONSTRAINT "repository_metrics_synced_at_check" CHECK(datetime("__new_repository_metrics"."synced_at") is not null)
);
--> statement-breakpoint
INSERT INTO `__new_repository_metrics`("latest_commit_at", "library_id", "stars", "synced_at") SELECT "latest_commit_at", "library_id", "stars", "synced_at" FROM `repository_metrics`;--> statement-breakpoint
DROP TABLE `repository_metrics`;--> statement-breakpoint
ALTER TABLE `__new_repository_metrics` RENAME TO `repository_metrics`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `repository_metrics_stars_idx` ON `repository_metrics` (`stars`);--> statement-breakpoint
CREATE INDEX `repository_metrics_latest_commit_at_idx` ON `repository_metrics` (`latest_commit_at`);