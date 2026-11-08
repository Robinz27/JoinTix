CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"slip" text NOT NULL,
	"qr_hash" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'review' NOT NULL,
	"trans_ref" text DEFAULT '' NOT NULL,
	"paid_amount" double precision,
	"sender_name" text DEFAULT '' NOT NULL,
	"paid_at" timestamp with time zone,
	"check_code" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"approved_via" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('review', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "token_transactions" DROP CONSTRAINT "token_transactions_order_id_unique";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_status_check";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_quantity_check";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "zone_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allow_reentry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "promptpay_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "promptpay_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "slip_check" text DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "attendees" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_sales" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "attendee_first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "attendee_last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "attendee_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD COLUMN "slip" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_review_idx" ON "payments" USING btree ("created_at") WHERE "payments"."status" = 'review';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_qr_once_idx" ON "payments" USING btree ("qr_hash") WHERE "payments"."qr_hash" <> '' and "payments"."status" <> 'rejected';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_trans_ref_once_idx" ON "payments" USING btree ("trans_ref") WHERE "payments"."trans_ref" <> '' and "payments"."status" <> 'rejected';--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "token_transactions_ticket_idx" ON "token_transactions" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_transactions_ticket_purchase_idx" ON "token_transactions" USING btree ("ticket_id") WHERE "token_transactions"."reason" = 'ticket_purchase';--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_slip_check_check" CHECK ("events"."slip_check" in ('api', 'manual'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_zone_check" CHECK (("orders"."zone_id" is null) = ("orders"."quantity" = 0));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('pending', 'review', 'paid', 'cancelled', 'expired'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_check" CHECK ("orders"."quantity" between 0 and 20);--> statement-breakpoint
-- Backfill: tickets bought before attendees were asked carry the buyer's name and email
UPDATE "tickets" SET "attendee_first_name" = "user"."name", "attendee_email" = "user"."email" FROM "user" WHERE "user"."id" = "tickets"."user_id" AND "tickets"."attendee_first_name" = '';--> statement-breakpoint
-- Backfill: an order's ticket tokens go to its first ticket; other token rows to the buyer's earliest ticket at that event
UPDATE "token_transactions" SET "ticket_id" = "t"."id" FROM "tickets" "t" WHERE "token_transactions"."ticket_id" IS NULL AND "token_transactions"."reason" = 'ticket_purchase' AND "t"."order_id" = "token_transactions"."order_id" AND "t"."seq" = 1;--> statement-breakpoint
UPDATE "token_transactions" SET "ticket_id" = (SELECT "t"."id" FROM "tickets" "t" WHERE "t"."user_id" = "token_transactions"."user_id" AND "t"."event_id" = "token_transactions"."event_id" ORDER BY "t"."created_at", "t"."seq" LIMIT 1) WHERE "ticket_id" IS NULL;--> statement-breakpoint
UPDATE "shop_sales" SET "ticket_id" = (SELECT "t"."id" FROM "tickets" "t" WHERE "t"."user_id" = "shop_sales"."user_id" AND "t"."event_id" = "shop_sales"."event_id" ORDER BY "t"."created_at", "t"."seq" LIMIT 1) WHERE "ticket_id" IS NULL;
