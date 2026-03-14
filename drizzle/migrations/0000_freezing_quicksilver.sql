CREATE TYPE "public"."call_type" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."customer_sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('photo', 'scan', 'contract', 'id_card', 'other');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('success', 'no_answer', 'voicemail', 'busy', 'failed');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('twilio_voice', 'twilio_sms', 'openai_token');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'manager', 'agent', 'user');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'lost');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('manual', 'scheduled', 'event');--> statement-breakpoint
CREATE TYPE "public"."type" AS ENUM('ai_qualification', 'human_appointment', 'hybrid_reception');--> statement-breakpoint
CREATE TABLE "agent_performance" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_performance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agent_id" integer NOT NULL,
	"calls_count" integer DEFAULT 0,
	"conversion_rate" numeric(5, 2),
	"avg_duration" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_switch_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_switch_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agent_id" integer NOT NULL,
	"status" varchar(50),
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointment_reminders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointment_reminders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"appointment_id" integer,
	"reminder_type" "reminder_type" DEFAULT 'email',
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" text DEFAULT 'pending',
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"agent_id" integer,
	"title" varchar(255) NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'scheduled',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer,
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100),
	"entity_id" integer,
	"changes" json,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blacklisted_numbers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blacklisted_numbers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phone_number" varchar(50) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "blacklisted_numbers_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "call_execution_metrics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_execution_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"call_id" integer,
	"agent_id" integer,
	"talk_time" integer,
	"hold_time" integer,
	"wrap_up_time" integer,
	"script_adherence" numeric(5, 2),
	"customer_sentiment" "customer_sentiment",
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_scoring" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_scoring_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"call_id" integer,
	"scored_by" integer,
	"overall_score" numeric(5, 2) NOT NULL,
	"communication_score" numeric(5, 2),
	"knowledge_score" numeric(5, 2),
	"professionalism_score" numeric(5, 2),
	"feedback" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"agent_id" integer,
	"call_type" "call_type" DEFAULT 'outbound',
	"status" text DEFAULT 'scheduled',
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration" integer,
	"outcome" "outcome",
	"notes" text,
	"call_sid" varchar(255),
	"recording_url" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaign_prospects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_prospects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"campaign_id" integer,
	"prospect_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"contacted_at" timestamp,
	"converted_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "type" DEFAULT 'hybrid_reception',
	"status" text DEFAULT 'active',
	"settings" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coaching_feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coaching_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agent_id" integer NOT NULL,
	"call_id" integer NOT NULL,
	"feedback" text NOT NULL,
	"score" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "command_validations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "command_validations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"validated_by" integer,
	"command" text NOT NULL,
	"validated_at" timestamp DEFAULT now(),
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "compliance_alerts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "compliance_alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"severity" "severity",
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "compliance_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"action" varchar(255) NOT NULL,
	"status" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"invoice_number" varchar(100) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR',
	"status" text DEFAULT 'draft',
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_at" timestamp,
	"pdf_url" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_type" "document_type" DEFAULT 'other',
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "failed_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "failed_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"job_id" varchar(255) NOT NULL,
	"queue_name" varchar(255) DEFAULT 'servicall-main' NOT NULL,
	"payload" json NOT NULL,
	"error" text,
	"retry_count" integer DEFAULT 0,
	"last_attempt" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"subscription_id" integer,
	"invoice_number" varchar(100) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR',
	"status" text DEFAULT 'pending',
	"stripe_invoice_id" varchar(255),
	"pdf_url" text,
	"due_date" timestamp,
	"paid_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"workflow_id" integer,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"payload" json,
	"result" json,
	"retry_count" integer DEFAULT 0,
	"next_run_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"campaign_id" integer,
	"type" varchar(50) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"external_sid" varchar(255),
	"error" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "predictive_scores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "predictive_scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"score" numeric(5, 2),
	"factors" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "processed_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" varchar(100) NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prospects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"email" text,
	"phone" text,
	"company" varchar(255),
	"source" varchar(100),
	"status" "status" DEFAULT 'new',
	"assigned_to" integer,
	"notes" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recordings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"call_id" integer,
	"recording_url" text,
	"duration" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rgpd_consents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rgpd_consents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"consent_type" varchar(100) NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp,
	"revoked_at" timestamp,
	"ip_address" varchar(45),
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "security_audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer,
	"user_id" integer,
	"event" varchar(100) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" varchar(255),
	"action" varchar(50),
	"status" varchar(20),
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "simulated_calls" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"scenario_id" varchar(255) NOT NULL,
	"status" text DEFAULT 'in_progress',
	"transcript" json,
	"duration" integer DEFAULT 0,
	"score" integer DEFAULT 0,
	"feedback" json,
	"objectives_achieved" json,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stripe_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stripe_event_id" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"payload" json NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"error" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stripe_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"plan" "plan" DEFAULT 'free',
	"status" text DEFAULT 'active',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"stripe_subscription_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"assigned_to" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"priority" "priority" DEFAULT 'medium',
	"status" text DEFAULT 'todo',
	"due_date" timestamp,
	"completed_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenant_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'agent',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"logo" text,
	"settings" json,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"open_id" varchar(255) NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"password_hash" varchar(255),
	"login_method" varchar(50),
	"role" "role" DEFAULT 'user',
	"last_signed_in" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"trigger_type" "trigger_type" DEFAULT 'manual',
	"trigger_config" json,
	"actions" json NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_suggestions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"confidence" numeric(3, 2),
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_ai_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_ai_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"workflow_id" integer,
	"model" varchar(100),
	"tokens_used" integer,
	"cost" numeric(10, 6),
	"status" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"subject" varchar(255),
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"product_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"order_number" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR',
	"payment_status" varchar(50) DEFAULT 'unpaid',
	"shipping_address" json,
	"billing_address" json,
	"notes" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "tenant_ai_keys" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenant_ai_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"provider" varchar(50) DEFAULT 'openai' NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_ai_keys_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_industry_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenant_industry_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"industry_id" varchar(255) NOT NULL,
	"enabled_capabilities" json,
	"enabled_workflows" json,
	"ai_system_prompt" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_industry_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"industry_id" varchar(255) NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"trigger_type" varchar(50),
	"steps" json NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_performance" ADD CONSTRAINT "agent_performance_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_switch_history" ADD CONSTRAINT "agent_switch_history_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_execution_metrics" ADD CONSTRAINT "call_execution_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_execution_metrics" ADD CONSTRAINT "call_execution_metrics_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_execution_metrics" ADD CONSTRAINT "call_execution_metrics_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_scoring" ADD CONSTRAINT "call_scoring_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_scoring" ADD CONSTRAINT "call_scoring_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_scoring" ADD CONSTRAINT "call_scoring_scored_by_users_id_fk" FOREIGN KEY ("scored_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_feedback" ADD CONSTRAINT "coaching_feedback_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_feedback" ADD CONSTRAINT "coaching_feedback_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_validations" ADD CONSTRAINT "command_validations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_validations" ADD CONSTRAINT "command_validations_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_validations" ADD CONSTRAINT "command_validations_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_alerts" ADD CONSTRAINT "compliance_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_logs" ADD CONSTRAINT "compliance_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_scores" ADD CONSTRAINT "predictive_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_scores" ADD CONSTRAINT "predictive_scores_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rgpd_consents" ADD CONSTRAINT "rgpd_consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rgpd_consents" ADD CONSTRAINT "rgpd_consents_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_calls" ADD CONSTRAINT "simulated_calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_calls" ADD CONSTRAINT "simulated_calls_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_ai_usage" ADD CONSTRAINT "audit_ai_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ai_keys" ADD CONSTRAINT "tenant_ai_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_industry_config" ADD CONSTRAINT "tenant_industry_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_reminders_tenant_id_idx" ON "appointment_reminders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "appointment_reminders_appointment_id_idx" ON "appointment_reminders" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_reminders_scheduled_for_idx" ON "appointment_reminders" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "appointment_reminders_status_idx" ON "appointment_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_number_idx" ON "blacklisted_numbers" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "call_execution_metrics_tenant_id_idx" ON "call_execution_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "call_execution_metrics_call_id_idx" ON "call_execution_metrics" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "call_execution_metrics_agent_id_idx" ON "call_execution_metrics" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "call_scoring_tenant_id_idx" ON "call_scoring" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "call_scoring_call_id_idx" ON "call_scoring" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "call_scoring_scored_by_idx" ON "call_scoring" USING btree ("scored_by");--> statement-breakpoint
CREATE INDEX "calls_tenant_id_idx" ON "calls" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "calls_prospect_id_idx" ON "calls" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "calls_agent_id_idx" ON "calls" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "calls_status_idx" ON "calls" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "call_sid_idx" ON "calls" USING btree ("call_sid");--> statement-breakpoint
CREATE INDEX "calls_tenant_created_idx" ON "calls" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "calls_tenant_status_idx" ON "calls" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "calls_tenant_user_idx" ON "calls" USING btree ("tenant_id","agent_id");--> statement-breakpoint
CREATE INDEX "campaign_prospects_tenant_id_idx" ON "campaign_prospects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaign_prospects_campaign_id_idx" ON "campaign_prospects" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_prospects_prospect_id_idx" ON "campaign_prospects" USING btree ("prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_campaign_prospect_unique" ON "campaign_prospects" USING btree ("campaign_id","prospect_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_id_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "command_validations_tenant_id_idx" ON "command_validations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "command_validations_prospect_id_idx" ON "command_validations" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "customer_invoices_tenant_id_idx" ON "customer_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_invoices_prospect_id_idx" ON "customer_invoices" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "customer_invoices_status_idx" ON "customer_invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_invoices_invoice_number_idx" ON "customer_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "documents_tenant_id_idx" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_prospect_id_idx" ON "documents" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "failed_jobs_job_id_idx" ON "failed_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "failed_jobs_created_at_idx" ON "failed_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoices_tenant_id_idx" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_tenant_created_idx" ON "invoices" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_tenant_status_idx" ON "invoices" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "jobs_tenant_id_idx" ON "jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "jobs_workflow_created_idx" ON "jobs" USING btree ("workflow_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_retry_count_idx" ON "jobs" USING btree ("retry_count");--> statement-breakpoint
CREATE INDEX "messages_tenant_id_idx" ON "messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "messages_prospect_id_idx" ON "messages" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "messages_status_idx" ON "messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_tenant_created_idx" ON "messages" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_tenant_status_idx" ON "messages" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "predictive_scores_tenant_id_idx" ON "predictive_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "predictive_scores_prospect_id_idx" ON "predictive_scores" USING btree ("prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_source_event_unique" ON "processed_events" USING btree ("source","event_id");--> statement-breakpoint
CREATE INDEX "prospects_tenant_id_idx" ON "prospects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prospects_status_idx" ON "prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prospects_assigned_to_idx" ON "prospects" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_prospects_lookup" ON "prospects" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "prospects_tenant_created_idx" ON "prospects" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "prospects_tenant_status_idx" ON "prospects" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "prospects_tenant_user_idx" ON "prospects" USING btree ("tenant_id","assigned_to");--> statement-breakpoint
CREATE INDEX "recordings_tenant_id_idx" ON "recordings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recordings_call_id_idx" ON "recordings" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "rgpd_consents_tenant_id_idx" ON "rgpd_consents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "rgpd_consents_prospect_id_idx" ON "rgpd_consents" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "rgpd_consents_consent_type_idx" ON "rgpd_consents" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "security_audit_tenant_idx" ON "security_audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "security_audit_user_idx" ON "security_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_audit_tenant_created_idx" ON "security_audit_logs" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "security_audit_tenant_status_idx" ON "security_audit_logs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "security_audit_tenant_user_idx" ON "security_audit_logs" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "simulated_calls_tenant_id_idx" ON "simulated_calls" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "simulated_calls_agent_id_idx" ON "simulated_calls" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "simulated_calls_scenario_id_idx" ON "simulated_calls" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "simulated_calls_status_idx" ON "simulated_calls" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_event_id_idx" ON "stripe_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "stripe_events_status_idx" ON "stripe_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_tenant_id_idx" ON "tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tasks_prospect_id_idx" ON "tasks" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_to_idx" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_user_unique" ON "tenant_users" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "tenant_users_user_id_idx" ON "tenant_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_users_tenant_id_idx" ON "tenant_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "open_id_idx" ON "users" USING btree ("open_id");--> statement-breakpoint
CREATE INDEX "workflows_tenant_id_idx" ON "workflows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflows_is_active_idx" ON "workflows" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflows_tenant_created_idx" ON "workflows" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflows_tenant_status_idx" ON "workflows" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "workflows_tenant_user_idx" ON "workflows" USING btree ("tenant_id","created_by");--> statement-breakpoint
CREATE INDEX "idx_ai_suggestions_tenant_id_idx" ON "ai_suggestions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_ai_usage_tenant_id_idx" ON "audit_ai_usage" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_ai_usage_created_at_idx" ON "audit_ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_message_templates_tenant_id_idx" ON "message_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_id_idx" ON "orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_orders_prospect_id_idx" ON "orders" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_orders_order_number_idx_unique" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_ai_keys_tenant_id_unique" ON "tenant_ai_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_ai_keys_provider_idx" ON "tenant_ai_keys" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_industry_config_tenant_id_unique" ON "tenant_industry_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_template_idx" ON "workflow_templates" USING btree ("industry_id","template_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_industry_id_idx" ON "workflow_templates" USING btree ("industry_id");