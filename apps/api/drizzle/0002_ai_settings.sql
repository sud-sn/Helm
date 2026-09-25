CREATE TABLE "ai_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"endpoint" text NOT NULL,
	"deployment" text NOT NULL,
	"api_version" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"api_key_hint" text NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_single_row" CHECK ("ai_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;