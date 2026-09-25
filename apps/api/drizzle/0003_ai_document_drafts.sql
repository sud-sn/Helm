ALTER TABLE "ai_runs" DROP CONSTRAINT "ai_runs_task_check";--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "doc_type" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "ai_run_id" uuid;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_task_check" CHECK ("ai_runs"."task" in ('meeting_action_items', 'page_draft', 'connection_test'));--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_doc_type_check" CHECK ("pages"."doc_type" in ('technical_spec', 'delivery_document'));