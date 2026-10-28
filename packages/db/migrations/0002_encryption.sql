CREATE TABLE "enc_epochs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"epk" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" text PRIMARY KEY NOT NULL,
	"image_ref" text,
	"git_sha" text,
	"started_at" timestamp with time zone NOT NULL,
	"seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP INDEX "messages_tsv_idx";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "media" SET DATA TYPE text USING "media"::text;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "raw" SET DATA TYPE text USING "raw"::text;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "wrapped_key" text;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "epoch_id" bigint;--> statement-breakpoint
ALTER TABLE "wa_sessions" ADD COLUMN "public_key" text;--> statement-breakpoint
ALTER TABLE "enc_epochs" ADD CONSTRAINT "enc_epochs_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "tsv";--> statement-breakpoint
-- Commands carried plaintext (sent texts, files); they are now wiped after execution. Purge the history.
DELETE FROM "commands";--> statement-breakpoint
-- Downloaded media were stored unencrypted.
DELETE FROM "media_files";
