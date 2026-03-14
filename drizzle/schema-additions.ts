/**
 * SCHEMA ADDITIONS FOR INDUSTRY CONFIGURATION & AI KEY MANAGEMENT
 * À ajouter au fichier drizzle/schema.ts
 */

import { pgTable, varchar, integer, timestamp, text, boolean, json, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants, prospects, campaigns, users } from "./schema";

// ============================================
// TENANT_INDUSTRY_CONFIG TABLE
// ============================================
export const tenantIndustryConfig = pgTable("tenant_industry_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  industryId: varchar("industry_id", { length: 255 }).notNull(),
  enabledCapabilities: json("enabled_capabilities"),
  enabledWorkflows: json("enabled_workflows"),
  aiSystemPrompt: text("ai_system_prompt"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: uniqueIndex("idx_tenant_industry_config_tenant_id_unique").on(table.tenantId),
}));

export type TenantIndustryConfig = typeof tenantIndustryConfig.$inferSelect;
export type InsertTenantIndustryConfig = typeof tenantIndustryConfig.$inferInsert;

// ============================================
// TENANT_AI_KEYS TABLE (Encrypted Storage - BYOK)
// ============================================
export const tenantAiKeys = pgTable("tenant_ai_keys", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull().default("openai"),
  encryptedKey: text("encrypted_key").notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  lastValidatedAt: timestamp("last_validated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: uniqueIndex("idx_tenant_ai_keys_tenant_id_unique").on(table.tenantId),
  providerIdx: index("idx_tenant_ai_keys_provider_idx").on(table.provider),
}));

export type TenantAiKey = typeof tenantAiKeys.$inferSelect;
export type InsertTenantAiKey = typeof tenantAiKeys.$inferInsert;

// ============================================
// WORKFLOW_TEMPLATES TABLE
// ============================================
export const workflowTemplates = pgTable("workflow_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  industryId: varchar("industry_id", { length: 255 }).notNull(),
  templateId: varchar("template_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerType: varchar("trigger_type", { length: 50 }),
  steps: json("steps").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueTemplate: uniqueIndex("unique_template_idx").on(table.industryId, table.templateId),
  industryIdIdx: index("idx_workflow_templates_industry_id_idx").on(table.industryId),
}));

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;

// ============================================
// AUDIT_AI_USAGE TABLE
// ============================================
export const auditAiUsage = pgTable("audit_ai_usage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  workflowId: integer("workflow_id"),
  model: varchar("model", { length: 100 }),
  tokensUsed: integer("tokens_used"),
  cost: decimal("cost", { precision: 10, scale: 6 }),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_audit_ai_usage_tenant_id_idx").on(table.tenantId),
  createdAtIdx: index("idx_audit_ai_usage_created_at_idx").on(table.createdAt),
}));

export type AuditAiUsage = typeof auditAiUsage.$inferSelect;
export type InsertAuditAiUsage = typeof auditAiUsage.$inferInsert;

// ============================================
// MESSAGE_TEMPLATES TABLE
// ============================================
export const messageTemplates = pgTable("message_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'sms', 'whatsapp', 'email'
  subject: varchar("subject", { length: 255 }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_message_templates_tenant_id_idx").on(table.tenantId),
}));

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

// ============================================
// AI_SUGGESTIONS TABLE
// ============================================
export const aiSuggestions = pgTable("ai_suggestions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  type: varchar("type", { length: 50 }).notNull(), // 'upsell', 'retention', 'followup'
  content: text("content").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'accepted', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_ai_suggestions_tenant_id_idx").on(table.tenantId),
}));

export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type InsertAiSuggestion = typeof aiSuggestions.$inferInsert;

// ============================================
// ORDERS TABLE
// ============================================
export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  orderNumber: varchar("order_number", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("unpaid"), // 'unpaid', 'paid', 'partially_paid', 'refunded'
  shippingAddress: json("shipping_address"),
  billingAddress: json("billing_address"),
  notes: text("notes"),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_orders_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_orders_prospect_id_idx").on(table.prospectId),
  statusIdx: index("idx_orders_status_idx").on(table.status),
  orderNumberIdx: uniqueIndex("idx_orders_order_number_idx_unique").on(table.orderNumber),
}));

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================
// ORDER_ITEMS TABLE
// ============================================
export const orderItems = pgTable("order_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  metadata: json("metadata"),
}, (table) => ({
  orderIdIdx: index("idx_order_items_order_id_idx").on(table.orderId),
}));

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================
// RELATIONS
// ============================================
export const tenantIndustryConfigRelations = relations(tenantIndustryConfig, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantIndustryConfig.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantAiKeysRelations = relations(tenantAiKeys, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantAiKeys.tenantId],
    references: [tenants.id],
  }),
}));

export const auditAiUsageRelations = relations(auditAiUsage, ({one}) => ({
  tenant: one(tenants, {
    fields: [auditAiUsage.tenantId],
    references: [tenants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  prospect: one(prospects, {
    fields: [orders.prospectId],
    references: [prospects.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

// ============================================
// PROCESSED_EVENTS TABLE (Idempotency)
// ============================================
export const processedEvents = pgTable("processed_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  source: varchar("source", { length: 255 }).notNull(),
  eventId: varchar("event_id", { length: 255 }).notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
}, (table) => ({
  uniqueEvent: uniqueIndex("unique_processed_event_idx").on(table.source, table.eventId),
  sourceIdx: index("idx_processed_events_source_idx").on(table.source),
  processedAtIdx: index("idx_processed_events_processed_at_idx").on(table.processedAt),
}));

export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type InsertProcessedEvent = typeof processedEvents.$inferInsert;

// ============================================
// FAILED_JOBS TABLE (Job Queue Error Tracking)
// ============================================
export const failedJobs = pgTable("failed_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  jobType: varchar("job_type", { length: 100 }).notNull(),
  payload: json("payload"),
  error: text("error"),
  stackTrace: text("stack_trace"),
  failedAt: timestamp("failed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_failed_jobs_tenant_id_idx").on(table.tenantId),
  jobTypeIdx: index("idx_failed_jobs_job_type_idx").on(table.jobType),
  failedAtIdx: index("idx_failed_jobs_failed_at_idx").on(table.failedAt),
}));

export type FailedJob = typeof failedJobs.$inferSelect;
export type InsertFailedJob = typeof failedJobs.$inferInsert;

// ============================================
// APPOINTMENTS TABLE
// ============================================
export const appointments = pgTable("appointments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  agentId: integer("agent_id").references(() => tenants.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").default(30), // in minutes
  status: varchar("status", { length: 50 }).default("scheduled"), // 'scheduled', 'completed', 'cancelled', 'no_show'
  location: varchar("location", { length: 255 }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_appointments_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_appointments_prospect_id_idx").on(table.prospectId),
  agentIdIdx: index("idx_appointments_agent_id_idx").on(table.agentId),
  scheduledAtIdx: index("idx_appointments_scheduled_at_idx").on(table.scheduledAt),
  statusIdx: index("idx_appointments_status_idx").on(table.status),
}));

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

// ============================================
// BLACKLISTED_NUMBERS TABLE (Security)
// ============================================
export const blacklistedNumbers = pgTable("blacklisted_numbers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  reason: text("reason"),
  addedBy: integer("added_by").references(() => tenants.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  phoneNumberIdx: uniqueIndex("idx_blacklisted_numbers_phone_unique").on(table.phoneNumber),
  tenantIdIdx: index("idx_blacklisted_numbers_tenant_id_idx").on(table.tenantId),
}));

export type BlacklistedNumber = typeof blacklistedNumbers.$inferSelect;
export type InsertBlacklistedNumber = typeof blacklistedNumbers.$inferInsert;

// ============================================
// SECURITY_AUDIT_LOGS TABLE
// ============================================
export const securityAuditLogs = pgTable("security_audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => tenants.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 50 }).default("low"), // 'low', 'medium', 'high', 'critical'
  description: text("description"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_security_audit_logs_tenant_id_idx").on(table.tenantId),
  eventTypeIdx: index("idx_security_audit_logs_event_type_idx").on(table.eventType),
  severityIdx: index("idx_security_audit_logs_severity_idx").on(table.severity),
  createdAtIdx: index("idx_security_audit_logs_created_at_idx").on(table.createdAt),
}));

export type SecurityAuditLog = typeof securityAuditLogs.$inferSelect;
export type InsertSecurityAuditLog = typeof securityAuditLogs.$inferInsert;

// ============================================
// COMPLIANCE_LOGS TABLE
// ============================================
export const complianceLogs = pgTable("compliance_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: integer("resource_id"),
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  checkedAt: timestamp("checked_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_compliance_logs_tenant_id_idx").on(table.tenantId),
  eventTypeIdx: index("idx_compliance_logs_event_type_idx").on(table.eventType),
  createdAtIdx: index("idx_compliance_logs_created_at_idx").on(table.createdAt),
}));

export type ComplianceLog = typeof complianceLogs.$inferSelect;
export type InsertComplianceLog = typeof complianceLogs.$inferInsert;

// ============================================
// COMPLIANCE_ALERTS TABLE
// ============================================
export const complianceAlerts = pgTable("compliance_alerts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  alertType: varchar("alert_type", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open"), // 'open', 'resolved', 'ignored'
  severity: varchar("severity", { length: 50 }).default("medium"), // 'low', 'medium', 'high', 'critical'
  resolved: boolean("resolved").default(false),              // Indicateur de résolution
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),                            // Description de la résolution
  resource: varchar("resource", { length: 100 }),            // Ressource concernée
  resourceId: varchar("resource_id", { length: 255 }),       // ID de la ressource
  metadata: json("metadata"),
  detectedAt: timestamp("detected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_compliance_alerts_tenant_id_idx").on(table.tenantId),
  alertTypeIdx: index("idx_compliance_alerts_alert_type_idx").on(table.alertType),
  statusIdx: index("idx_compliance_alerts_status_idx").on(table.status),
  severityIdx: index("idx_compliance_alerts_severity_idx").on(table.severity),
}));

export type ComplianceAlert = typeof complianceAlerts.$inferSelect;
export type InsertComplianceAlert = typeof complianceAlerts.$inferInsert;

// ============================================
// RECORDINGS TABLE
// ============================================
export const recordings = pgTable("recordings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  callId: integer("call_id").references(() => campaigns.id, { onDelete: "set null" }),
  recordingSid: varchar("recording_sid", { length: 255 }),
  recordingUrl: text("recording_url"),
  duration: integer("duration"), // in seconds
  status: varchar("status", { length: 50 }).default("available"), // 'available', 'deleted', 'expired'
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_recordings_tenant_id_idx").on(table.tenantId),
  callIdIdx: index("idx_recordings_call_id_idx").on(table.callId),
  recordingSidIdx: uniqueIndex("idx_recordings_recording_sid_unique").on(table.recordingSid),
}));

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = typeof recordings.$inferInsert;

// ============================================
// CALL_SCORING TABLE (AI Quality Metrics)
// ============================================
export const callScoring = pgTable("call_scoring", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  callId: integer("call_id").references(() => campaigns.id, { onDelete: "cascade" }),
  overallScore: decimal("overall_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  sentimentScore: decimal("sentiment_score", { precision: 3, scale: 2 }),
  clarityScore: decimal("clarity_score", { precision: 3, scale: 2 }),
  professionalismScore: decimal("professionalism_score", { precision: 3, scale: 2 }),
  feedback: text("feedback"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_call_scoring_tenant_id_idx").on(table.tenantId),
  callIdIdx: index("idx_call_scoring_call_id_idx").on(table.callId),
}));

export type CallScoring = typeof callScoring.$inferSelect;
export type InsertCallScoring = typeof callScoring.$inferInsert;

// ============================================
// CALL_EXECUTION_METRICS TABLE
// ============================================
export const callExecutionMetrics = pgTable("call_execution_metrics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  callId: integer("call_id").references(() => campaigns.id, { onDelete: "cascade" }),
  callReceivedAt: timestamp("call_received_at"),  // Timestamp de réception de l'appel
  timestamps: json("timestamps"),                 // Timestamps détaillés des étapes
  executionTime: integer("execution_time"), // in milliseconds
  apiCalls: integer("api_calls"),
  tokensUsed: integer("tokens_used"),
  cost: decimal("cost", { precision: 10, scale: 6 }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_call_execution_metrics_tenant_id_idx").on(table.tenantId),
  callIdIdx: index("idx_call_execution_metrics_call_id_idx").on(table.callId),
}));

export type CallExecutionMetric = typeof callExecutionMetrics.$inferSelect;
export type InsertCallExecutionMetric = typeof callExecutionMetrics.$inferInsert;

// ============================================
// STRIPE_EVENTS TABLE (Webhook Events)
// ============================================
export const stripeEvents = pgTable("stripe_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  eventId: varchar("event_id", { length: 255 }).notNull().unique(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  payload: json("payload").notNull(),
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  eventIdIdx: uniqueIndex("idx_stripe_events_event_id_unique").on(table.eventId),
  eventTypeIdx: index("idx_stripe_events_event_type_idx").on(table.eventType),
  processedIdx: index("idx_stripe_events_processed_idx").on(table.processed),
}));

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type InsertStripeEvent = typeof stripeEvents.$inferInsert;

// ============================================
// APPOINTMENT_REMINDERS TABLE
// ============================================
export const appointmentReminders = pgTable("appointment_reminders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  reminderType: varchar("reminder_type", { length: 50 }).default("email"), // 'email', 'sms', 'push'
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'sent', 'failed'
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_appointment_reminders_tenant_id_idx").on(table.tenantId),
  appointmentIdIdx: index("idx_appointment_reminders_appointment_id_idx").on(table.appointmentId),
  scheduledAtIdx: index("idx_appointment_reminders_scheduled_at_idx").on(table.scheduledAt),
  statusIdx: index("idx_appointment_reminders_status_idx").on(table.status),
}));

export type AppointmentReminder = typeof appointmentReminders.$inferSelect;
export type InsertAppointmentReminder = typeof appointmentReminders.$inferInsert;

// ============================================
// AGENT_SWITCH_HISTORY TABLE
// ============================================
export const agentSwitchHistory = pgTable("agent_switch_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  fromRole: varchar("from_role", { length: 50 }),
  toRole: varchar("to_role", { length: 50 }),
  reason: text("reason"),
  metadata: json("metadata"),
  previousAgentType: varchar("previous_agent_type", { length: 10 }),
  newAgentType: varchar("new_agent_type", { length: 10 }),
  callId: integer("call_id"),
  triggeredBy: varchar("triggered_by", { length: 50 }),
  triggeredByUserId: integer("triggered_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_agent_switch_history_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("idx_agent_switch_history_user_id_idx").on(table.userId),
  createdAtIdx: index("idx_agent_switch_history_created_at_idx").on(table.createdAt),
}));

export type AgentSwitchHistory = typeof agentSwitchHistory.$inferSelect;
export type InsertAgentSwitchHistory = typeof agentSwitchHistory.$inferInsert;

// ============================================
// CUSTOMER_INVOICES TABLE
// ============================================
export const customerInvoices = pgTable("customer_invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  callId: integer("call_id"),                              // Appel associé
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }), // Montant TTC
  currency: varchar("currency", { length: 3 }).default("EUR"),
  description: text("description"),                        // Description de la facture
  template: varchar("template", { length: 100 }).default("default"), // Modèle de facture
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'paid', 'overdue', 'cancelled'
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  secureToken: text("secure_token"),
  secureLink: text("secure_link"),
  linkExpiresAt: timestamp("link_expires_at"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("unpaid"),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_customer_invoices_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_customer_invoices_prospect_id_idx").on(table.prospectId),
  invoiceNumberIdx: uniqueIndex("idx_customer_invoices_invoice_number_unique").on(table.invoiceNumber),
  statusIdx: index("idx_customer_invoices_status_idx").on(table.status),
}));

export type CustomerInvoice = typeof customerInvoices.$inferSelect;
export type InsertCustomerInvoice = typeof customerInvoices.$inferInsert;


// ============================================
// COACHING_FEEDBACK TABLE
// ============================================
export const coachingFeedback = pgTable("coaching_feedback", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  callId: integer("call_id").references(() => campaigns.id, { onDelete: "set null" }),
  coachId: integer("coach_id").references(() => tenants.id, { onDelete: "set null" }),
  feedback: text("feedback").notNull(),
  rating: integer("rating"), // 1-5
  strengths: json("strengths"),
  improvements: json("improvements"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_coaching_feedback_tenant_id_idx").on(table.tenantId),
  agentIdIdx: index("idx_coaching_feedback_agent_id_idx").on(table.agentId),
  callIdIdx: index("idx_coaching_feedback_call_id_idx").on(table.callId),
}));

export type CoachingFeedback = typeof coachingFeedback.$inferSelect;
export type InsertCoachingFeedback = typeof coachingFeedback.$inferInsert;

// ============================================
// AGENT_PERFORMANCE TABLE
// ============================================
export const agentPerformance = pgTable("agent_performance", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull(), // 'daily', 'weekly', 'monthly'
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  averageDuration: integer("average_duration"), // in seconds
  averageScore: decimal("average_score", { precision: 3, scale: 2 }),
  metrics: json("metrics"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_agent_performance_tenant_id_idx").on(table.tenantId),
  agentIdIdx: index("idx_agent_performance_agent_id_idx").on(table.agentId),
  periodIdx: index("idx_agent_performance_period_idx").on(table.period),
  periodStartIdx: index("idx_agent_performance_period_start_idx").on(table.periodStart),
}));

export type AgentPerformance = typeof agentPerformance.$inferSelect;
export type InsertAgentPerformance = typeof agentPerformance.$inferInsert;

// ============================================
// SIMULATED_CALLS TABLE
// ============================================
// ✅ CORRECTIONS BUG COACHING:
// 1. id: varchar(255) (UUID) au lieu de integer auto-increment (compatible avec crypto.randomUUID())
// 2. agentId: référence users.id (pas tenants.id) - FK fix
// 3. transcript: json au lieu de text (stockage structuré du tableau de messages)
// 4. feedback: json au lieu de text (stockage structuré de l'objet feedback)
// 5. Ajout colonnes manquantes: status, objectivesAchieved, startedAt, completedAt, updatedAt
export const simulatedCalls = pgTable("simulated_calls", {
  id: varchar("id", { length: 255 }).primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").references(() => users.id, { onDelete: "set null" }),
  scenarioId: varchar("scenario_id", { length: 255 }),
  scenarioName: varchar("scenario_name", { length: 255 }),
  status: text("status").default("in_progress"), // 'in_progress', 'completed', 'abandoned'
  duration: integer("duration").default(0), // in seconds
  score: integer("score").default(0),
  // ✅ FIX: json au lieu de text pour stocker les tableaux/objets structurés
  transcript: json("transcript").$type<Array<{ timestamp: number; speaker: string; text: string; sentiment?: number }>>(),
  feedback: json("feedback").$type<{ strengths: string[]; weaknesses: string[]; recommendations: string[] }>(),
  objectivesAchieved: json("objectives_achieved").$type<string[]>(),
  metadata: json("metadata"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_simulated_calls_tenant_id_idx").on(table.tenantId),
  agentIdIdx: index("idx_simulated_calls_agent_id_idx").on(table.agentId),
  scenarioIdIdx: index("idx_simulated_calls_scenario_id_idx").on(table.scenarioId),
}));

export type SimulatedCall = typeof simulatedCalls.$inferSelect;
export type InsertSimulatedCall = typeof simulatedCalls.$inferInsert;

// ============================================
// RGPD_CONSENTS TABLE
// ============================================
export const rgpdConsents = pgTable("rgpd_consents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  consentType: varchar("consent_type", { length: 100 }).notNull(), // 'marketing', 'data_processing', 'call_recording'
  granted: boolean("granted").default(false),
  grantedAt: timestamp("granted_at"),  resolvedAt: timestamp("resolved_at"),
  metadata: json("metadata"),
  detectedAt: timestamp("detected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),}, (table) => ({
  tenantIdIdx: index("idx_rgpd_consents_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_rgpd_consents_prospect_id_idx").on(table.prospectId),
  consentTypeIdx: index("idx_rgpd_consents_consent_type_idx").on(table.consentType),
}));

export type RgpdConsent = typeof rgpdConsents.$inferSelect;
export type InsertRgpdConsent = typeof rgpdConsents.$inferInsert;

// ============================================
// TASKS TABLE
// ============================================
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assignedTo: integer("assigned_to").references(() => tenants.id, { onDelete: "set null" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'in_progress', 'completed', 'cancelled'
  priority: varchar("priority", { length: 50 }).default("medium"), // 'low', 'medium', 'high', 'urgent'
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_tasks_tenant_id_idx").on(table.tenantId),
  assignedToIdx: index("idx_tasks_assigned_to_idx").on(table.assignedTo),
  prospectIdIdx: index("idx_tasks_prospect_id_idx").on(table.prospectId),
  statusIdx: index("idx_tasks_status_idx").on(table.status),
  priorityIdx: index("idx_tasks_priority_idx").on(table.priority),
}));

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ============================================
// PREDICTIVE_SCORES TABLE
// ============================================
export const predictiveScores = pgTable("predictive_scores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  invoiceId: integer("invoice_id"),                         // Facture associée
  scoreType: varchar("score_type", { length: 100 }).notNull().default("payment_prediction"), // 'conversion_likelihood', 'churn_risk', 'payment_prediction'
  score: decimal("score", { precision: 5, scale: 4 }), // 0.0000 to 1.0000
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  probabilityAcceptance: decimal("probability_acceptance", { precision: 5, scale: 4 }), // Probabilité d'acceptation
  estimatedPaymentDelay: integer("estimated_payment_delay"),  // Délai estimé en jours
  estimatedProcessingTime: integer("estimated_processing_time"), // Temps de traitement estimé
  recommendedChannel: varchar("recommended_channel", { length: 100 }), // Canal recommandé
  recommendedTime: varchar("recommended_time", { length: 100 }),       // Créneau recommandé
  successProbability: decimal("success_probability", { precision: 5, scale: 4 }), // Probabilité de succès
  riskFactors: json("risk_factors"),                        // Facteurs de risque
  factors: json("factors"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_predictive_scores_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_predictive_scores_prospect_id_idx").on(table.prospectId),
  scoreTypeIdx: index("idx_predictive_scores_score_type_idx").on(table.scoreType),
}));

export type PredictiveScore = typeof predictiveScores.$inferSelect;
export type InsertPredictiveScore = typeof predictiveScores.$inferInsert;

// ============================================
// COMMAND_VALIDATIONS TABLE
// ============================================
export const commandValidations = pgTable("command_validations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  callId: integer("call_id").references(() => campaigns.id, { onDelete: "set null" }),
  invoiceId: integer("invoice_id"),
  command: text("command").notNull(),
  validatedBy: varchar("validated_by", { length: 100 }).default("ai"), // 'ai', 'human', 'hybrid'
  validatedByUserId: integer("validated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  validationScore: integer("validation_score"),          // Score de validation (0-100)
  riskLevel: varchar("risk_level", { length: 50 }),      // 'low', 'medium', 'high', 'critical'
  requiresHumanReview: boolean("requires_human_review").default(false),
  reason: text("reason"),                                // Raison de la décision
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'approved', 'rejected', 'pending_review'
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_command_validations_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_command_validations_prospect_id_idx").on(table.prospectId),
  callIdIdx: index("idx_command_validations_call_id_idx").on(table.callId),
  statusIdx: index("idx_command_validations_status_idx").on(table.status),
}));

export type CommandValidation = typeof commandValidations.$inferSelect;
export type InsertCommandValidation = typeof commandValidations.$inferInsert;

// ============================================
// DOCUMENTS TABLE
// ============================================
export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }), // 'pdf', 'image', 'contract', 'invoice'
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"), // in bytes
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedBy: integer("uploaded_by").references(() => tenants.id, { onDelete: "set null" }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_documents_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_documents_prospect_id_idx").on(table.prospectId),
  typeIdx: index("idx_documents_type_idx").on(table.type),
}));

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ============================================
// USAGE_METRICS TABLE (Billing)
// ============================================
export const usageMetrics = pgTable("usage_metrics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  resourceType: varchar("resource_type", { length: 100 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  cost: decimal("cost", { precision: 10, scale: 6 }).notNull().default("0"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_usage_metrics_tenant_id_idx").on(table.tenantId),
  resourceTypeIdx: index("idx_usage_metrics_resource_type_idx").on(table.resourceType),
  createdAtIdx: index("idx_usage_metrics_created_at_idx").on(table.createdAt),
}));
export type UsageMetric = typeof usageMetrics.$inferSelect;
export type InsertUsageMetric = typeof usageMetrics.$inferInsert;

// ============================================
// USER_2FA TABLE (Two-Factor Authentication)
// ============================================
export const user2FA = pgTable("user_2fa", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  isEnabled: boolean("is_enabled").default(false),
  backupCodes: json("backup_codes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: uniqueIndex("idx_user_2fa_user_id_idx").on(table.userId),
}));
export type User2FA = typeof user2FA.$inferSelect;
export type InsertUser2FA = typeof user2FA.$inferInsert;
