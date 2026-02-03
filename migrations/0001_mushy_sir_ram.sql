CREATE TABLE "ai_assistant_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"assistant_name" text DEFAULT 'AI Assistant' NOT NULL,
	"welcome_message" text,
	"system_prompt_addition" text,
	"avatar_url" text,
	"primary_color" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_assistant_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"month_year" text NOT NULL,
	"monthly_limit_tokens" integer DEFAULT 50000 NOT NULL,
	"used_tokens" integer DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razorpay_event_id" text,
	"event_type" text NOT NULL,
	"company_id" varchar,
	"subscription_id" varchar,
	"payload" jsonb,
	"processed_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "billing_events_razorpay_event_id_unique" UNIQUE("razorpay_event_id")
);
--> statement-breakpoint
CREATE TABLE "company_module_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"module_id" varchar NOT NULL,
	"module_code" text NOT NULL,
	"razorpay_subscription_id" text,
	"razorpay_customer_id" text,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_paid" integer,
	"start_date" timestamp,
	"end_date" timestamp,
	"next_billing_date" timestamp,
	"last_payment_date" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_notification_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"user_id" varchar,
	"to_email" text NOT NULL,
	"to_name" text,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"template_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_vendor_costs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"vendor_name" text NOT NULL,
	"service_description" text NOT NULL,
	"estimated_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"actual_amount" numeric(12, 2),
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_date" date,
	"payment_reference" text,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "in_app_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"user_id" varchar,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"category" text,
	"action_url" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_client_inputs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_lead_id" varchar NOT NULL,
	"input_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"urls" jsonb,
	"attachments" jsonb,
	"status" text DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_event_flow_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_flow_id" varchar NOT NULL,
	"portal_lead_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" text,
	"end_time" text,
	"duration" integer,
	"category" text,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_event_flows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_lead_id" varchar NOT NULL,
	"event_name" text NOT NULL,
	"event_date" date,
	"event_time" text,
	"venue" text,
	"venue_address" text,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"published_by" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_lead_id" varchar NOT NULL,
	"overall_rating" integer,
	"planning_rating" integer,
	"execution_rating" integer,
	"communication_rating" integer,
	"decor_rating" integer,
	"comments" text,
	"suggestions" text,
	"would_recommend" boolean,
	"testimonial" text,
	"testimonial_approved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_financial_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_lead_id" varchar NOT NULL,
	"milestone_name" text NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"amount" numeric(12, 2),
	"due_description" text,
	"due_date" date,
	"days_before" integer,
	"is_paid" boolean DEFAULT false,
	"paid_amount" numeric(12, 2),
	"paid_at" timestamp,
	"payment_method" text,
	"payment_reference" text,
	"confirmed_by" varchar,
	"confirmed_at" timestamp,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp_number" text NOT NULL,
	"address" text,
	"city" text,
	"event_date" date,
	"event_type" text,
	"venue" text,
	"venue_city" text,
	"guest_count" integer,
	"budget_range" text,
	"services_required" jsonb,
	"additional_notes" text,
	"reference_urls" jsonb,
	"terms_accepted" boolean DEFAULT false,
	"otp_verified" boolean DEFAULT false,
	"otp_code" text,
	"otp_expires_at" timestamp,
	"portal_token" text,
	"portal_token_expires_at" timestamp,
	"phase" text DEFAULT 'submitted' NOT NULL,
	"phase_updated_at" timestamp DEFAULT now(),
	"assigned_planner_id" varchar,
	"assigned_planner_name" text,
	"assigned_at" timestamp,
	"reminder_sent_at" timestamp,
	"deal_id" varchar,
	"event_id" varchar,
	"shared_estimate_id" varchar,
	"shared_presentation_id" varchar,
	"shared_contract_url" text,
	"shared_presentation_url" text,
	"documents_shared_at" timestamp,
	"documents_shared_by" varchar,
	"client_approval_status" text DEFAULT 'pending',
	"client_approval_at" timestamp,
	"client_approval_notes" text,
	"client_signature_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_milestone_phases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_lead_id" varchar NOT NULL,
	"phase_number" integer NOT NULL,
	"phase_name" text NOT NULL,
	"description" text,
	"days_before_start" integer NOT NULL,
	"days_before_end" integer NOT NULL,
	"status" text DEFAULT 'upcoming',
	"is_locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"locked_by" varchar,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_milestone_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" varchar NOT NULL,
	"portal_lead_id" varchar NOT NULL,
	"task_name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending',
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"completed_by" varchar,
	"due_date" date,
	"requires_upload" boolean DEFAULT false,
	"upload_url" text,
	"upload_name" text,
	"uploaded_at" timestamp,
	"uploaded_by" varchar,
	"is_client_task" boolean DEFAULT false,
	"is_approval_required" boolean DEFAULT false,
	"approval_status" text,
	"approved_at" timestamp,
	"approved_by" varchar,
	"sort_order" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_oaksy_chats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"portal_lead_id" varchar,
	"visitor_name" text,
	"visitor_phone" text,
	"visitor_email" text,
	"chat_type" text DEFAULT 'landing' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb,
	"lead_collected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_timelines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_lead_id" varchar NOT NULL,
	"phase" integer NOT NULL,
	"phase_name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date" date,
	"time" text,
	"status" text DEFAULT 'upcoming',
	"icon" text,
	"sort_order" integer DEFAULT 0,
	"pushed_by" varchar,
	"pushed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_albums" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"title" text NOT NULL,
	"tagline" text,
	"venue" text,
	"cover_image_url" text NOT NULL,
	"category" text DEFAULT 'Wedding' NOT NULL,
	"event_date" date,
	"featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"venue" text,
	"image_url" text NOT NULL,
	"description" text,
	"event_date" date,
	"featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" varchar,
	"set_id" varchar,
	"image_url" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" varchar NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rsvp_bulk_imports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"error_report" jsonb,
	"column_mapping" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rsvp_form_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"placeholder" text,
	"default_value" text,
	"options" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"is_system_field" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rsvp_form_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar,
	"company_id" varchar NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"welcome_message" text,
	"confirmation_message" text,
	"deadline" timestamp,
	"require_email" boolean DEFAULT true NOT NULL,
	"require_phone" boolean DEFAULT false NOT NULL,
	"branding_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rsvp_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"guest_id" varchar,
	"guest_name" text NOT NULL,
	"guest_email" text,
	"guest_phone" text,
	"attending" text DEFAULT 'pending' NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"ip_address" text,
	"submitted_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saas_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"monthly_price" integer NOT NULL,
	"yearly_price" integer NOT NULL,
	"razorpay_monthly_plan_id" text,
	"razorpay_yearly_plan_id" text,
	"features" jsonb,
	"is_core" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "saas_modules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "ai_assistant_settings" ADD CONSTRAINT "ai_assistant_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_company_module_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."company_module_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_module_subscriptions" ADD CONSTRAINT "company_module_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_module_subscriptions" ADD CONSTRAINT "company_module_subscriptions_module_id_saas_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."saas_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notification_queue" ADD CONSTRAINT "email_notification_queue_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notification_queue" ADD CONSTRAINT "email_notification_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_vendor_costs" ADD CONSTRAINT "event_vendor_costs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_vendor_costs" ADD CONSTRAINT "event_vendor_costs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_client_inputs" ADD CONSTRAINT "portal_client_inputs_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_client_inputs" ADD CONSTRAINT "portal_client_inputs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_event_flow_items" ADD CONSTRAINT "portal_event_flow_items_event_flow_id_portal_event_flows_id_fk" FOREIGN KEY ("event_flow_id") REFERENCES "public"."portal_event_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_event_flow_items" ADD CONSTRAINT "portal_event_flow_items_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_event_flows" ADD CONSTRAINT "portal_event_flows_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_event_flows" ADD CONSTRAINT "portal_event_flows_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_event_flows" ADD CONSTRAINT "portal_event_flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_feedback" ADD CONSTRAINT "portal_feedback_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_financial_milestones" ADD CONSTRAINT "portal_financial_milestones_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_financial_milestones" ADD CONSTRAINT "portal_financial_milestones_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_leads" ADD CONSTRAINT "portal_leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_leads" ADD CONSTRAINT "portal_leads_assigned_planner_id_users_id_fk" FOREIGN KEY ("assigned_planner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_leads" ADD CONSTRAINT "portal_leads_deal_id_sales_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."sales_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_leads" ADD CONSTRAINT "portal_leads_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_leads" ADD CONSTRAINT "portal_leads_shared_estimate_id_estimates_id_fk" FOREIGN KEY ("shared_estimate_id") REFERENCES "public"."estimates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_leads" ADD CONSTRAINT "portal_leads_shared_presentation_id_presentations_id_fk" FOREIGN KEY ("shared_presentation_id") REFERENCES "public"."presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_leads" ADD CONSTRAINT "portal_leads_documents_shared_by_users_id_fk" FOREIGN KEY ("documents_shared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_milestone_phases" ADD CONSTRAINT "portal_milestone_phases_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_milestone_phases" ADD CONSTRAINT "portal_milestone_phases_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_milestone_tasks" ADD CONSTRAINT "portal_milestone_tasks_phase_id_portal_milestone_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."portal_milestone_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_milestone_tasks" ADD CONSTRAINT "portal_milestone_tasks_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_milestone_tasks" ADD CONSTRAINT "portal_milestone_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_milestone_tasks" ADD CONSTRAINT "portal_milestone_tasks_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_milestone_tasks" ADD CONSTRAINT "portal_milestone_tasks_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_oaksy_chats" ADD CONSTRAINT "portal_oaksy_chats_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_timelines" ADD CONSTRAINT "portal_timelines_portal_lead_id_portal_leads_id_fk" FOREIGN KEY ("portal_lead_id") REFERENCES "public"."portal_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_timelines" ADD CONSTRAINT "portal_timelines_pushed_by_users_id_fk" FOREIGN KEY ("pushed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_albums" ADD CONSTRAINT "portfolio_albums_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_albums" ADD CONSTRAINT "portfolio_albums_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_album_id_portfolio_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."portfolio_albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_set_id_portfolio_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."portfolio_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_sets" ADD CONSTRAINT "portfolio_sets_album_id_portfolio_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."portfolio_albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_bulk_imports" ADD CONSTRAINT "rsvp_bulk_imports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_bulk_imports" ADD CONSTRAINT "rsvp_bulk_imports_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_bulk_imports" ADD CONSTRAINT "rsvp_bulk_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_form_fields" ADD CONSTRAINT "rsvp_form_fields_template_id_rsvp_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."rsvp_form_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_form_templates" ADD CONSTRAINT "rsvp_form_templates_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_form_templates" ADD CONSTRAINT "rsvp_form_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_submissions" ADD CONSTRAINT "rsvp_submissions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_submissions" ADD CONSTRAINT "rsvp_submissions_template_id_rsvp_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."rsvp_form_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_submissions" ADD CONSTRAINT "rsvp_submissions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_submissions" ADD CONSTRAINT "rsvp_submissions_guest_id_event_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."event_guests"("id") ON DELETE no action ON UPDATE no action;