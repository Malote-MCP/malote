CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"session_id" uuid NOT NULL,
	"jid" text NOT NULL,
	"name" text,
	"is_group" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone,
	CONSTRAINT "chats_session_id_jid_pk" PRIMARY KEY("session_id","jid")
);
--> statement-breakpoint
CREATE TABLE "commands" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"session_id" uuid NOT NULL,
	"jid" text NOT NULL,
	"lid" text,
	"phone" text,
	"name" text,
	"notify" text,
	CONSTRAINT "contacts_session_id_jid_pk" PRIMARY KEY("session_id","jid")
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"chat_jid" text,
	"message_id" text,
	"mimetype" text NOT NULL,
	"file_name" text,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"session_id" uuid NOT NULL,
	"chat_jid" text NOT NULL,
	"id" text NOT NULL,
	"sender_jid" text,
	"sender_name" text,
	"from_me" boolean DEFAULT false NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"text" text,
	"quoted_id" text,
	"media" jsonb,
	"raw" jsonb,
	"edited" boolean DEFAULT false NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce("messages"."text", ''))) STORED,
	CONSTRAINT "messages_session_id_chat_jid_id_pk" PRIMARY KEY("session_id","chat_jid","id")
);
--> statement-breakpoint
CREATE TABLE "wa_auth" (
	"session_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "wa_auth_session_id_key_pk" PRIMARY KEY("session_id","key")
);
--> statement-breakpoint
CREATE TABLE "wa_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"qr" text,
	"qr_updated_at" timestamp with time zone,
	"phone" text,
	"wa_jid" text,
	"wa_lid" text,
	"push_name" text,
	"egress_ip" text,
	"worker_id" text,
	"last_error" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_sessions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_auth" ADD CONSTRAINT "wa_auth_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_hash_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_tokens_user_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chats_recent_idx" ON "chats" USING btree ("session_id","last_message_at");--> statement-breakpoint
CREATE INDEX "commands_pending_idx" ON "commands" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "contacts_lid_idx" ON "contacts" USING btree ("session_id","lid");--> statement-breakpoint
CREATE INDEX "media_files_msg_idx" ON "media_files" USING btree ("session_id","chat_jid","message_id");--> statement-breakpoint
CREATE INDEX "messages_chat_ts_idx" ON "messages" USING btree ("session_id","chat_jid","ts");--> statement-breakpoint
CREATE INDEX "messages_session_ts_idx" ON "messages" USING btree ("session_id","ts");--> statement-breakpoint
CREATE INDEX "messages_tsv_idx" ON "messages" USING gin ("tsv");