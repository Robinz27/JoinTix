CREATE TABLE "admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "merch_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merch_items_price_check" CHECK ("merch_items"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "merch_variants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"size" text NOT NULL,
	"capacity" integer NOT NULL,
	"sold" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "merch_variants_sold_check" CHECK ("merch_variants"."sold" between 0 and "merch_variants"."capacity")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"size" text NOT NULL,
	"unit_price" integer NOT NULL,
	"quantity" integer NOT NULL,
	"picked_up_at" timestamp with time zone,
	"picked_up_by" text,
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tokens" integer NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_items_tokens_check" CHECK ("shop_items"."tokens" >= 1)
);
--> statement-breakpoint
CREATE TABLE "shop_sale_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"sale_id" uuid NOT NULL,
	"item_id" uuid,
	"name" text NOT NULL,
	"tokens" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "shop_sale_items_quantity_check" CHECK ("shop_sale_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "shop_sales" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"tokens" integer NOT NULL,
	"baht" integer NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"sold_by" text,
	"voided_by" text,
	"voided_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_sales_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "shop_sales_status_check" CHECK ("shop_sales"."status" in ('completed', 'voided')),
	CONSTRAINT "shop_sales_tokens_check" CHECK ("shop_sales"."tokens" >= 1)
);
--> statement-breakpoint
CREATE TABLE "shop_staff" (
	"shop_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "shop_staff_shop_id_user_id_pk" PRIMARY KEY("shop_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "token_price" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD COLUMN "sale_id" uuid;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD COLUMN "baht" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD COLUMN "reverses" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "admin_role_id" uuid;--> statement-breakpoint
ALTER TABLE "merch_items" ADD CONSTRAINT "merch_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_variants" ADD CONSTRAINT "merch_variants_item_id_merch_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."merch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_merch_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."merch_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_picked_up_by_user_id_fk" FOREIGN KEY ("picked_up_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_sale_items" ADD CONSTRAINT "shop_sale_items_sale_id_shop_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."shop_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_sale_items" ADD CONSTRAINT "shop_sale_items_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_sold_by_user_id_fk" FOREIGN KEY ("sold_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_staff" ADD CONSTRAINT "shop_staff_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_staff" ADD CONSTRAINT "shop_staff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merch_items_event_id_idx" ON "merch_items" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "merch_variants_item_id_idx" ON "merch_variants" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_items_order_variant_idx" ON "order_items" USING btree ("order_id","variant_id");--> statement-breakpoint
CREATE INDEX "order_items_variant_id_idx" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "shop_items_shop_id_idx" ON "shop_items" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "shop_sale_items_sale_id_idx" ON "shop_sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "shop_sales_shop_idx" ON "shop_sales" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "shop_sales_event_idx" ON "shop_sales" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "shop_staff_user_id_idx" ON "shop_staff" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shops_event_id_idx" ON "shops" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_sale_id_shop_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."shop_sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_admin_role_id_admin_roles_id_fk" FOREIGN KEY ("admin_role_id") REFERENCES "public"."admin_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "token_transactions_event_idx" ON "token_transactions" USING btree ("event_id","created_at");--> statement-breakpoint
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_idempotency_key_unique" UNIQUE("idempotency_key");--> statement-breakpoint
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_reverses_unique" UNIQUE("reverses");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_token_price_check" CHECK ("events"."token_price" >= 1);--> statement-breakpoint
INSERT INTO "admin_roles" ("name", "description", "permissions") VALUES
	('ผู้จัดงาน', 'ดูแลอีเวนต์ ร้านค้า รายชื่อ และรายงาน', '{events.manage,attendees.view,shops.manage,reports.view}'),
	('ทีมหน้างาน', 'สแกนเข้างาน ส่งมอบเสื้อ และเติมโทเคน', '{door.scan,tokens.topup,attendees.view}'),
	('พนักงานร้านค้า', 'ขายและตัดโทเคนที่ร้านของตัวเอง', '{shops.sell}'),
	('ฝ่ายบัญชี', 'ดูรายงานและรายชื่อผู้ลงทะเบียน', '{reports.view,attendees.view}');
