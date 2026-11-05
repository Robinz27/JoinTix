CREATE TABLE "scan_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ticket_id" uuid,
	"event_id" uuid,
	"door_event_id" uuid,
	"scanned_by" text,
	"input" text NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_logs_result_check" CHECK ("scan_logs"."result" in ('valid', 'used', 'not_found', 'void', 'wrong_event', 'admitted', 'undone'))
);
--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_door_event_id_events_id_fk" FOREIGN KEY ("door_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_scanned_by_user_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_logs_event_idx" ON "scan_logs" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "scan_logs_door_event_idx" ON "scan_logs" USING btree ("door_event_id","created_at");