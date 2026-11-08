ALTER TABLE "events" ALTER COLUMN "max_per_order" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cohort" text DEFAULT '' NOT NULL;