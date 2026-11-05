ALTER TABLE "events" ADD COLUMN "venue_area" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "longitude" double precision;--> statement-breakpoint
-- Map pins for the sample events (0002), so the event page shows the venue block from the start
UPDATE "events" SET "venue_area" = v."area", "latitude" = v."lat", "longitude" = v."lng"
FROM (VALUES
	('midnight-echo', 'ปากเกร็ด นนทบุรี', 13.9122, 100.5488),
	('reunion-eng60', 'บางรัก กรุงเทพฯ', 13.7234, 100.5134),
	('indie-fest', 'ปทุมวัน กรุงเทพฯ', 13.7307, 100.5418),
	('countdown-2027', 'คลองสาน กรุงเทพฯ', 13.7267, 100.5103)
) AS v("slug", "area", "lat", "lng")
WHERE "events"."slug" = v."slug";
