CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"organizer" text NOT NULL,
	"venue" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"poster" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"doors_at" timestamp with time zone NOT NULL,
	"sales_start_at" timestamp with time zone NOT NULL,
	"sales_end_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"max_per_order" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_status_check" CHECK ("events"."status" in ('draft', 'published', 'closed')),
	CONSTRAINT "events_max_per_order_check" CHECK ("events"."max_per_order" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "ticket_zones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"capacity" integer NOT NULL,
	"sold" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_zones_price_check" CHECK ("ticket_zones"."price" >= 0),
	CONSTRAINT "ticket_zones_sold_check" CHECK ("ticket_zones"."sold" between 0 and "ticket_zones"."capacity")
);
--> statement-breakpoint
ALTER TABLE "ticket_zones" ADD CONSTRAINT "ticket_zones_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "ticket_zones_event_id_idx" ON "ticket_zones" USING btree ("event_id");--> statement-breakpoint
-- The sample events that used to live in src/lib/events.ts, so the site looks the same after this migration
WITH e AS (
	INSERT INTO "events" ("slug", "title", "organizer", "venue", "description", "poster", "starts_at", "doors_at", "sales_start_at", "status", "featured", "max_per_order") VALUES
	('midnight-echo', 'Midnight Echo Live 2026', 'Echo Entertainment', 'อิมแพ็ค อารีน่า เมืองทองธานี',
		E'คอนเสิร์ตใหญ่ครั้งแรกของ Midnight Echo กับเพลงฮิตครบทุกอัลบั้ม พร้อมแสง สี เสียงเต็มรูปแบบ\n\nประตูเปิด 17:30 น. แสดงบัตรและบัตรประชาชนที่ทางเข้า ไม่อนุญาตให้นำกล้องมืออาชีพเข้างาน',
		'/posters/midnight-echo.svg', '2026-12-14T19:00:00+07:00', '2026-12-14T17:30:00+07:00', '2026-11-01T10:00:00+07:00', 'published', true, 4),
	('reunion-eng60', 'งานเลี้ยงรุ่นวิศวะ รุ่น 60 คืนสู่เหย้า', 'สมาคมศิษย์เก่าวิศวะ รุ่น 60', 'โรงแรมริมน้ำ กรุงเทพฯ',
		E'คืนสู่เหย้าวิศวะ รุ่น 60 ดินเนอร์บุฟเฟต์ ดนตรีสด และกิจกรรมจับรางวัล\n\nแต่งกายสุภาพ ธีมสีน้ำเงิน ลงทะเบียนหน้างานตั้งแต่ 17:00 น.',
		'/posters/reunion-eng60.svg', '2026-12-27T18:00:00+07:00', '2026-12-27T17:00:00+07:00', '2026-10-15T09:00:00+07:00', 'published', true, 2),
	('indie-fest', 'Bangkok Indie Fest 2027', 'Bangkok Indie Collective', 'ลานกลางเมือง กรุงเทพฯ',
		E'เทศกาลดนตรีอินดี้กลางเมือง 3 เวที กว่า 20 วง ตั้งแต่บ่ายจนดึก\n\nมีโซนอาหารและตลาดนัดงานคราฟต์ เด็กอายุต่ำกว่า 12 ปีเข้าฟรีเมื่อมากับผู้ปกครอง',
		'/posters/indie-fest.svg', '2027-01-09T16:00:00+07:00', '2027-01-09T15:00:00+07:00', '2026-12-01T12:00:00+07:00', 'published', true, 6),
	('countdown-2027', 'Countdown 2027 ริมเจ้าพระยา', 'กรุงเทพมหานคร', 'ริมแม่น้ำเจ้าพระยา กรุงเทพฯ',
		E'นับถอยหลังสู่ปี 2027 ริมแม่น้ำเจ้าพระยา ชมพลุและคอนเสิร์ตฟรี\n\nต้องลงทะเบียนรับบัตรล่วงหน้าเพื่อจำกัดจำนวนคนในพื้นที่',
		'/posters/countdown-2027.svg', '2026-12-31T20:00:00+07:00', '2026-12-31T18:00:00+07:00', '2026-12-01T10:00:00+07:00', 'published', true, 2)
	RETURNING "id", "slug"
)
INSERT INTO "ticket_zones" ("event_id", "name", "note", "price", "capacity", "sold", "position")
SELECT e."id", z."name", z."note", z."price", z."capacity", z."sold", z."position"
FROM e JOIN (VALUES
	('midnight-echo', 'VIP', 'ยืนหน้าเวที + ของที่ระลึก', 6500, 100, 100, 0),
	('midnight-echo', 'โซน A', 'ที่นั่งมีหมายเลข', 4500, 400, 388, 1),
	('midnight-echo', 'โซน B', 'ที่นั่งมีหมายเลข', 3200, 500, 414, 2),
	('midnight-echo', 'โซน C', 'ที่นั่งมีหมายเลข', 1800, 800, 560, 3),
	('reunion-eng60', 'โต๊ะจีน (ต่อที่นั่ง)', 'ที่นั่งโต๊ะละ 10 คน', 1500, 200, 136, 0),
	('reunion-eng60', 'บุฟเฟต์', 'ที่นั่งอิสระ', 1200, 300, 170, 1),
	('indie-fest', 'Early Bird', 'บัตรยืน เข้าได้ทุกเวที', 890, 300, 0, 0),
	('indie-fest', 'บัตรทั่วไป', 'บัตรยืน เข้าได้ทุกเวที', 1290, 800, 0, 1),
	('countdown-2027', 'บัตรเข้างาน', 'ลงทะเบียนฟรี', 0, 5000, 5000, 0)
) AS z("slug", "name", "note", "price", "capacity", "sold", "position") ON z."slug" = e."slug";
