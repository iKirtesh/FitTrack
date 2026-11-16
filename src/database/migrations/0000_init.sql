CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fitness_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`target_value` real NOT NULL,
	`start_value` real,
	`unit` text,
	`deadline` text,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schema_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`photo_uri` text,
	`date_of_birth` text,
	`gender` text,
	`height_cm` real,
	`weight_kg` real,
	`target_weight_kg` real,
	`experience` text DEFAULT 'beginner' NOT NULL,
	`goal` text DEFAULT 'general_fitness' NOT NULL,
	`activity_level` text DEFAULT 'moderate' NOT NULL,
	`preferred_workout_type` text,
	`preferred_workout_days` text DEFAULT '[]' NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`distance_unit` text DEFAULT 'km' NOT NULL,
	`daily_step_target` integer DEFAULT 8000 NOT NULL,
	`daily_calorie_target` integer,
	`daily_water_target_ml` integer DEFAULT 2500 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`muscle_group_id` text NOT NULL,
	`secondary_muscles` text DEFAULT '[]' NOT NULL,
	`equipment` text NOT NULL,
	`instructions` text,
	`image_uri` text,
	`difficulty` text DEFAULT 'intermediate' NOT NULL,
	`exercise_type` text DEFAULT 'strength' NOT NULL,
	`tracking_type` text NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`seed_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `exercises_muscle_idx` ON `exercises` (`muscle_group_id`);--> statement-breakpoint
CREATE INDEX `exercises_name_idx` ON `exercises` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_seed_key_uq` ON `exercises` (`seed_key`);--> statement-breakpoint
CREATE TABLE `muscle_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`rest_sec` integer DEFAULT 90 NOT NULL,
	`notes` text,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `we_session_idx` ON `workout_exercises` (`session_id`,`position`);--> statement-breakpoint
CREATE INDEX `we_exercise_idx` ON `workout_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_plan_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`day_of_week` integer,
	`day_name` text,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`target_reps` integer,
	`target_weight_kg` real,
	`target_duration_sec` integer,
	`target_distance_m` real,
	`rest_sec` integer DEFAULT 90 NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `wpe_plan_idx` ON `workout_plan_exercises` (`plan_id`,`day_of_week`,`position`);--> statement-breakpoint
CREATE INDEX `wpe_exercise_idx` ON `workout_plan_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`plan_id` text,
	`date` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_sec` integer,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`rpe` real,
	`notes` text,
	`total_volume_kg` real DEFAULT 0 NOT NULL,
	`set_count` integer DEFAULT 0 NOT NULL,
	`calories_estimate` integer,
	`import_hash` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ws_date_idx` ON `workout_sessions` (`date`);--> statement-breakpoint
CREATE INDEX `ws_status_idx` ON `workout_sessions` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `ws_import_hash_uq` ON `workout_sessions` (`import_hash`);--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_exercise_id` text NOT NULL,
	`set_order` integer NOT NULL,
	`kind` text DEFAULT 'normal' NOT NULL,
	`weight_kg` real,
	`reps` integer,
	`duration_sec` integer,
	`distance_m` real,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`workout_exercise_id`) REFERENCES `workout_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wset_order_uq` ON `workout_sets` (`workout_exercise_id`,`set_order`);--> statement-breakpoint
CREATE TABLE `cardio_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_type` text NOT NULL,
	`custom_name` text,
	`date` text NOT NULL,
	`started_at` integer NOT NULL,
	`duration_sec` integer NOT NULL,
	`distance_m` real,
	`calories_estimate` integer,
	`avg_speed_mps` real,
	`avg_heart_rate` integer,
	`max_heart_rate` integer,
	`intensity` text,
	`notes` text,
	`import_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cardio_date_idx` ON `cardio_sessions` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `cardio_import_hash_uq` ON `cardio_sessions` (`import_hash`);--> statement-breakpoint
CREATE TABLE `gps_route_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`altitude_m` real,
	`accuracy_m` real,
	`speed_mps` real,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `running_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gps_session_seq_uq` ON `gps_route_points` (`session_id`,`seq`);--> statement-breakpoint
CREATE TABLE `running_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_type` text NOT NULL,
	`date` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`moving_time_sec` integer,
	`distance_m` real DEFAULT 0 NOT NULL,
	`avg_pace_sec_per_km` real,
	`fastest_pace_sec_per_km` real,
	`avg_speed_mps` real,
	`elevation_gain_m` real,
	`steps` integer,
	`calories_estimate` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`notes` text,
	`import_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `run_date_idx` ON `running_sessions` (`date`);--> statement-breakpoint
CREATE INDEX `run_status_idx` ON `running_sessions` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `run_import_hash_uq` ON `running_sessions` (`import_hash`);--> statement-breakpoint
CREATE TABLE `running_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`split_index` integer NOT NULL,
	`distance_m` real NOT NULL,
	`duration_sec` real NOT NULL,
	`pace_sec_per_km` real NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `running_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `split_session_idx_uq` ON `running_splits` (`session_id`,`split_index`);--> statement-breakpoint
CREATE TABLE `activity_counters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT 'reps' NOT NULL,
	`step` real DEFAULT 1 NOT NULL,
	`daily_target` real,
	`is_built_in` integer DEFAULT false NOT NULL,
	`built_in_key` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `counter_builtin_uq` ON `activity_counters` (`built_in_key`);--> statement-breakpoint
CREATE TABLE `counter_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`counter_id` text NOT NULL,
	`date` text NOT NULL,
	`delta` real NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`counter_id`) REFERENCES `activity_counters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `counter_entries_idx` ON `counter_entries` (`counter_id`,`date`);--> statement-breakpoint
CREATE TABLE `daily_activity` (
	`date` text PRIMARY KEY NOT NULL,
	`steps` integer DEFAULT 0 NOT NULL,
	`steps_source` text DEFAULT 'manual' NOT NULL,
	`calories_estimate` integer,
	`water_ml` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `body_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real,
	`body_fat_pct` real,
	`chest_cm` real,
	`waist_cm` real,
	`hips_cm` real,
	`arms_cm` real,
	`forearms_cm` real,
	`thighs_cm` real,
	`calves_cm` real,
	`neck_cm` real,
	`photo_uri` text,
	`notes` text,
	`import_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bm_date_idx` ON `body_measurements` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `bm_import_hash_uq` ON `body_measurements` (`import_hash`);--> statement-breakpoint
CREATE TABLE `achievements` (
	`key` text PRIMARY KEY NOT NULL,
	`unlocked_at` integer NOT NULL,
	`evidence` text
);
--> statement-breakpoint
CREATE TABLE `personal_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`subject_id` text,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`achieved_at` integer NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pr_kind_subject_uq` ON `personal_records` (`kind`,`subject_id`);--> statement-breakpoint
CREATE INDEX `pr_date_idx` ON `personal_records` (`date`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`hour` integer NOT NULL,
	`minute` integer NOT NULL,
	`days_of_week` text DEFAULT '[0,1,2,3,4,5,6]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`notification_ids` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reminders_kind_idx` ON `reminders` (`kind`);