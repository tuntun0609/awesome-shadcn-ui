CREATE TABLE `github_metrics` (
	`latest_commit_at` text,
	`library_id` integer PRIMARY KEY NOT NULL,
	`stars` integer NOT NULL,
	`synced_at` text NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "github_metrics_stars_check" CHECK("github_metrics"."stars" >= 0),
	CONSTRAINT "github_metrics_latest_commit_at_check" CHECK("github_metrics"."latest_commit_at" is null or datetime("github_metrics"."latest_commit_at") is not null),
	CONSTRAINT "github_metrics_synced_at_check" CHECK(datetime("github_metrics"."synced_at") is not null)
);
--> statement-breakpoint
CREATE INDEX `github_metrics_stars_idx` ON `github_metrics` (`stars`);--> statement-breakpoint
CREATE INDEX `github_metrics_latest_commit_at_idx` ON `github_metrics` (`latest_commit_at`);--> statement-breakpoint
CREATE TABLE `libraries` (
	`access` text NOT NULL,
	`added_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`description` text NOT NULL,
	`featured_rank` integer,
	`github` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logo` text,
	`name` text NOT NULL,
	`pricing` text NOT NULL,
	`slug` text NOT NULL,
	`source` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`website` text NOT NULL,
	CONSTRAINT "libraries_slug_check" CHECK(length("libraries"."slug") > 0
        and "libraries"."slug" not glob '*[^a-z0-9-]*'
        and "libraries"."slug" not like '-%'
        and "libraries"."slug" not like '%-'
        and "libraries"."slug" not like '%--%'),
	CONSTRAINT "libraries_source_check" CHECK("libraries"."source" in ('open-source', 'source-available', 'proprietary', 'undisclosed')),
	CONSTRAINT "libraries_pricing_check" CHECK("libraries"."pricing" in ('free', 'freemium', 'paid', 'undisclosed')),
	CONSTRAINT "libraries_access_check" CHECK("libraries"."access" in ('direct', 'login-required', 'purchase-required', 'undisclosed')),
	CONSTRAINT "libraries_added_at_check" CHECK(length("libraries"."added_at") = 10
        and "libraries"."added_at" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        and date("libraries"."added_at") = "libraries"."added_at"),
	CONSTRAINT "libraries_featured_rank_check" CHECK("libraries"."featured_rank" is null or "libraries"."featured_rank" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_slug_unique` ON `libraries` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_featured_rank_unique` ON `libraries` (`featured_rank`);--> statement-breakpoint
CREATE TABLE `library_deliveries` (
	`library_id` integer NOT NULL,
	`position` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`library_id`, `value`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "library_deliveries_value_check" CHECK("library_deliveries"."value" in ('components', 'blocks', 'templates')),
	CONSTRAINT "library_deliveries_position_check" CHECK("library_deliveries"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_deliveries_position_unique` ON `library_deliveries` (`library_id`,`position`);--> statement-breakpoint
CREATE INDEX `library_deliveries_value_idx` ON `library_deliveries` (`value`);--> statement-breakpoint
CREATE TABLE `library_tags` (
	`library_id` integer NOT NULL,
	`position` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`library_id`, `value`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "library_tags_value_check" CHECK(length(trim("library_tags"."value")) > 0),
	CONSTRAINT "library_tags_position_check" CHECK("library_tags"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_tags_position_unique` ON `library_tags` (`library_id`,`position`);--> statement-breakpoint
CREATE INDEX `library_tags_value_idx` ON `library_tags` (`value`);--> statement-breakpoint
CREATE TABLE `library_use_cases` (
	`library_id` integer NOT NULL,
	`position` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`library_id`, `value`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "library_use_cases_value_check" CHECK("library_use_cases"."value" in ('marketing', 'dashboard', 'commerce', 'content', 'data-display', 'ai')),
	CONSTRAINT "library_use_cases_position_check" CHECK("library_use_cases"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_use_cases_position_unique` ON `library_use_cases` (`library_id`,`position`);--> statement-breakpoint
CREATE INDEX `library_use_cases_value_idx` ON `library_use_cases` (`value`);