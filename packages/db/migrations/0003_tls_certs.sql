CREATE TABLE "tls_certs" (
	"hostname" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"not_after" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
