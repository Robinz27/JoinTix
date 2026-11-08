CREATE TABLE "order_shipments" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"fee" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"subdistrict" text NOT NULL,
	"district" text NOT NULL,
	"province" text NOT NULL,
	"postcode" text NOT NULL,
	"carrier" text DEFAULT '' NOT NULL,
	"tracking_no" text DEFAULT '' NOT NULL,
	"shipped_at" timestamp with time zone,
	"shipped_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_shipments_fee_check" CHECK ("order_shipments"."fee" >= 0)
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "shipping_fee" integer;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_shipped_by_user_id_fk" FOREIGN KEY ("shipped_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_shipping_fee_check" CHECK ("events"."shipping_fee" >= 0);