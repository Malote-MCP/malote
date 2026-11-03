CREATE TABLE "billing" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"plan" text,
	"trial_ends_at" timestamp with time zone NOT NULL,
	"paid_until" timestamp with time zone,
	"bonus_days" integer DEFAULT 0 NOT NULL,
	"free_forever" boolean DEFAULT false NOT NULL,
	"access_until" timestamp with time zone,
	"referral_code" text NOT NULL,
	"referred_by" text,
	"asaas_customer_id" text,
	"asaas_subscription_id" text,
	"asaas_checkout_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"referred_user_id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"wa_jid" text,
	"rewarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_referral_code_idx" ON "billing" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "billing_subscription_idx" ON "billing" USING btree ("asaas_subscription_id");--> statement-breakpoint
CREATE INDEX "billing_checkout_idx" ON "billing" USING btree ("asaas_checkout_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_wa_jid_idx" ON "referrals" USING btree ("wa_jid");--> statement-breakpoint
-- Everyone who already has an account starts the 15-day trial at launch. Neon Auth's table only
-- exists where Neon Auth is enabled (not on a fresh test or self-hosted database).
DO $$ BEGIN
  IF to_regclass('neon_auth."user"') IS NOT NULL THEN
    INSERT INTO "billing" ("user_id", "trial_ends_at", "access_until", "referral_code")
    SELECT u.id::text, now() + interval '15 days', now() + interval '15 days', substr(md5(random()::text || u.id::text), 1, 8)
    FROM neon_auth."user" u
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
