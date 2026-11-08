ALTER TABLE "merch_items" ADD COLUMN "image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "merch_items" ADD COLUMN "option_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "merch_items" ADD COLUMN "max_per_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "option_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "merch_items" ADD CONSTRAINT "merch_items_max_per_order_check" CHECK ("merch_items"."max_per_order" >= 0);--> statement-breakpoint
UPDATE "merch_items" SET "option_label" = 'ไซส์';--> statement-breakpoint
UPDATE "order_items" SET "option_label" = 'ไซส์';
