CREATE TABLE "send_counts" (
	"session_id" uuid NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "send_counts_session_id_day_pk" PRIMARY KEY("session_id","day")
);
--> statement-breakpoint
CREATE TABLE "send_limits" (
	"user_id" text PRIMARY KEY NOT NULL,
	"per_minute" integer,
	"per_day" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "send_counts" ADD CONSTRAINT "send_counts_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;