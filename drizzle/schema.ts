import { pgTable, varchar, integer, timestamp, text, boolean, json, decimal, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
export * from "./schema-additions";
export * from "./schema-industries";
export * from "./schema-business";
export * from "./schema-recruitment";
export * from "./schema-deals";
export * from "./schema-social";

// ============================================
// WORKFLOW_EXECUTIONS TABLE
// ============================================
export const workflowExecutions = pgTable("workflow_executions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'completed', 'failed'
  trigger: varchar("trigger", { length: 100 }).notNull(),
  input: json("input"),
  output: json("output"),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  workflowIdIdx: index("workflow_executions_workflow_id_idx").on(table.workflowId),
  tenantIdIdx: index("workflow_executions_tenant_id_idx").on(table.tenantId),
  statusIdx: index("workflow_executions_status_idx").on(table.status),
  createdAtIdx: index("workflow_executions_created_at_idx").on(table.createdAt),
}));

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowExecution = typeof workflowExecutions.$inferInsert;

// ============================================
// ENUMS
// ============================================
export const roleEnum = pgEnum("role", ["owner", "superadmin", "admin", "manager", "agent", "agentIA", "user"]);
export const statusEnum = pgEnum("status", ["new", "contacted", "qualified", "converted", "lost"]);
export const call_typeEnum = pgEnum("call_type", ["inbound", "outbound"]);
export const outcomeEnum = pgEnum("outcome", ["success", "no_answer", "voicemail", "busy", "failed"]);
export const trigger_typeEnum = pgEnum("trigger_type", ["manual", "scheduled", "event"]);
export const planEnum = pgEnum("plan", ["free", "starter", "professional", "enterprise"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const customer_sentimentEnum = pgEnum("customer_sentiment", ["positive", "neutral", "negative"]);
export const typeEnum = pgEnum("type", ["ai_qualification", "human_appointment", "hybrid_reception"]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const resource_typeEnum = pgEnum("resource_type", ["twilio_voice", "twilio_sms", "openai_token"]);
export const reminder_typeEnum = pgEnum("reminder_type", ["email", "sms", "push"]);
export const document_typeEnum = pgEnum("document_type", ["photo", "scan", "contract", "id_card", "other"]);

// ============================================
// USERS TABLE
// ============================================
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("open_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  loginMethod: varchar("login_method", { length: 50 }),
  role: roleEnum("role").default("user"),
  lastSignedIn: timestamp("last_signed_in"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  assignedAgentType: varchar("assigned_agent_type", { length: 10 }).default("AI"),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  openIdIdx: uniqueIndex("open_id_idx").on(table.openId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================
// TENANTS TABLE
// ============================================
export const tenants = pgTable("tenants", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  logo: text("logo"),
  settings: json("settings"),
  businessType: varchar("business_type", { length: 50 }),
  aiCustomScript: text("ai_custom_script"),
  posProvider: varchar("pos_provider", { length: 50 }),
  posConfig: json("pos_config"),
  posSyncEnabled: boolean("pos_sync_enabled").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex("slug_idx").on(table.slug),
}));

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ============================================
// TENANT_USERS TABLE (Many-to-Many)
// ============================================
export const tenantUsers = pgTable("tenant_users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("agent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantUserUniqueIdx: uniqueIndex("idx_tenant_user_unique").on(table.tenantId, table.userId),
  userIdIdx: index("tenant_users_user_id_idx").on(table.userId),
  tenantIdIdx: index("tenant_users_tenant_id_idx").on(table.tenantId),
}));

export type TenantUser = typeof tenantUsers.$inferSelect;
export type InsertTenantUser = typeof tenantUsers.$inferInsert;

// ============================================
// PROSPECTS TABLE (Leads)
// ============================================
export const prospects = pgTable("prospects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  email: text("email"), // Encrypted
  phone: text("phone"), // Encrypted
  company: varchar("company", { length: 255 }),
  jobTitle: varchar("job_title", { length: 255 }),
  source: varchar("source", { length: 100 }),
  status: statusEnum("status").default("new"),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  priority: varchar("priority", { length: 50 }).default("medium"),
  dueDate: timestamp("due_date"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("prospects_tenant_id_idx").on(table.tenantId),
  statusIdx: index("prospects_status_idx").on(table.status),
  assignedToIdx: index("prospects_assigned_to_idx").on(table.assignedTo),
  prospectsLookupIdx: index("idx_prospects_lookup").on(table.tenantId, table.phone),
  tenantCreatedIdx: index("prospects_tenant_created_idx").on(table.tenantId, table.createdAt.desc()),
  tenantStatusIdx: index("prospects_tenant_status_idx").on(table.tenantId, table.status),
  tenantUserIdx: index("prospects_tenant_user_idx").on(table.tenantId, table.assignedTo),
}));

export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = typeof prospects.$inferInsert;

// ============================================
// CALLS TABLE
// ============================================
export const calls = pgTable("calls", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  agentId: integer("agent_id").references(() => users.id, { onDelete: "set null" }),
  callType: call_typeEnum("call_type").default("outbound"),
  direction: varchar("direction", { length: 20 }).default("outbound"),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  status: text("status").default("scheduled"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // in seconds
  outcome: outcomeEnum("outcome"),
  notes: text("notes"),
  callSid: varchar("call_sid", { length: 255 }), // SID Twilio
  recordingUrl: text("recording_url"),
  recordingKey: text("recording_key"),          // Clé S3 de l'enregistrement
  fromNumber: varchar("from_number", { length: 50 }),  // Numéro appelant
  toNumber: varchar("to_number", { length: 50 }),      // Numéro appelé
  transcription: text("transcription"),          // Transcription de l'appel
  summary: text("summary"),                      // Résumé IA
  qualityScore: varchar("quality_score", { length: 10 }), // Score qualité
  sentiment: varchar("sentiment", { length: 50 }), // Sentiment détecté
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("calls_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("calls_prospect_id_idx").on(table.prospectId),
  agentIdIdx: index("calls_agent_id_idx").on(table.agentId),
  statusIdx: index("calls_status_idx").on(table.status),
  callSidIdx: uniqueIndex("call_sid_idx").on(table.callSid),
  tenantCreatedIdx: index("calls_tenant_created_idx").on(table.tenantId, table.createdAt.desc()),
  tenantStatusIdx: index("calls_tenant_status_idx").on(table.tenantId, table.status),
  tenantUserIdx: index("calls_tenant_user_idx").on(table.tenantId, table.agentId),
}));

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;

// ============================================
// MESSAGES TABLE
// ============================================
export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  type: varchar("type", { length: 50 }).notNull(), // 'sms' or 'whatsapp'
  direction: varchar("direction", { length: 20 }).notNull(), // 'inbound' or 'outbound'
  content: text("content").notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  externalSid: varchar("external_sid", { length: 255 }),
  error: text("error"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("messages_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("messages_prospect_id_idx").on(table.prospectId),
  statusIdx: index("messages_status_idx").on(table.status),
  tenantCreatedIdx: index("messages_tenant_created_idx").on(table.tenantId, table.createdAt.desc()),
  tenantStatusIdx: index("messages_tenant_status_idx").on(table.tenantId, table.status),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ============================================
// WORKFLOWS TABLE
// ============================================
export const workflows = pgTable("workflows", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerType: trigger_typeEnum("trigger_type").default("manual"),
  triggerConfig: json("trigger_config"),
  actions: json("actions").notNull(),
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("workflows_tenant_id_idx").on(table.tenantId),
  isActiveIdx: index("workflows_is_active_idx").on(table.isActive),
  tenantCreatedIdx: index("workflows_tenant_created_idx").on(table.tenantId, table.createdAt.desc()),
  tenantStatusIdx: index("workflows_tenant_status_idx").on(table.tenantId, table.isActive),
  tenantUserIdx: index("workflows_tenant_user_idx").on(table.tenantId, table.createdBy),
}));

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

// ============================================
// CAMPAIGNS TABLE
// ============================================
export const campaigns = pgTable("campaigns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: typeEnum("type").default("hybrid_reception"),
  activityType: varchar("activity_type", { length: 100 }), // Pivot pour les métiers
  status: text("status").default("active"),
    details: json("details"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("campaigns_tenant_id_idx").on(table.tenantId),
  statusIdx: index("campaigns_status_idx").on(table.status),
  activityIdx: index("campaigns_activity_idx").on(table.activityType),
}));

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ============================================
// SUBSCRIPTIONS, INVOICES, AUDIT LOGS, etc.
// ============================================
export const subscriptions = pgTable("subscriptions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  plan: planEnum("plan").default("free"),
  status: text("status").default("active"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  status: text("status").default("pending"),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
  pdfUrl: text("pdf_url"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("invoices_tenant_id_idx").on(table.tenantId),
  invoiceNumberIdx: uniqueIndex("invoices_invoice_number_idx").on(table.invoiceNumber),
  statusIdx: index("invoices_status_idx").on(table.status),
  tenantCreatedIdx: index("invoices_tenant_created_idx").on(table.tenantId, table.createdAt.desc()),
  tenantStatusIdx: index("invoices_tenant_status_idx").on(table.tenantId, table.status),
}));

export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 255 }).notNull(),
  details: json("details"),
  resource: varchar("resource", { length: 255 }),
  resourceId: integer("resource_id"),
  resourceType: varchar("resource_type", { length: 100 }),
  changes: json("changes"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("audit_logs_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));

export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;

export const jobs = pgTable("jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  workflowId: integer("workflow_id").references(() => workflows.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  payload: json("payload"),
  result: json("result"),
  retryCount: integer("retry_count").default(0),
  nextRunAt: timestamp("next_run_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("jobs_tenant_id_idx").on(table.tenantId),
  workflowCreatedIdx: index("jobs_workflow_created_idx").on(table.workflowId, table.createdAt.desc()),
  statusIdx: index("jobs_status_idx").on(table.status),
}));

// ============================================
// RELATIONS
// ============================================
export const usersRelations = relations(users, ({ many }) => ({
  tenantUsers: many(tenantUsers),
  prospects: many(prospects),
  calls: many(calls),
  workflows: many(workflows),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  tenantUsers: many(tenantUsers),
  prospects: many(prospects),
  calls: many(calls),
  messages: many(messages),
  workflows: many(workflows),
  campaigns: many(campaigns),
  subscriptions: many(subscriptions),
  invoices: many(invoices),
  auditLogs: many(auditLogs),
  jobs: many(jobs),
  workflowExecutions: many(workflowExecutions),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantUsers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantUsers.userId],
    references: [users.id],
  }),
}));

export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [prospects.tenantId],
    references: [tenants.id],
  }),
  assignedTo: one(users, {
    fields: [prospects.assignedTo],
    references: [users.id],
  }),
  calls: many(calls),
  messages: many(messages),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  tenant: one(tenants, {
    fields: [calls.tenantId],
    references: [tenants.id],
  }),
  prospect: one(prospects, {
    fields: [calls.prospectId],
    references: [prospects.id],
  }),
  agent: one(users, {
    fields: [calls.agentId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messages.tenantId],
    references: [tenants.id],
  }),
  prospect: one(prospects, {
    fields: [messages.prospectId],
    references: [prospects.id],
  }),
  campaign: one(campaigns, {
    fields: [messages.campaignId],
    references: [campaigns.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [workflows.tenantId],
    references: [tenants.id],
  }),
  createdBy: one(users, {
    fields: [workflows.createdBy],
    references: [users.id],
  }),
  executions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowExecutions.workflowId],
    references: [workflows.id],
  }),
  tenant: one(tenants, {
    fields: [workflowExecutions.tenantId],
    references: [tenants.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [campaigns.tenantId],
    references: [tenants.id],
  }),
  messages: many(messages),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [jobs.tenantId],
    references: [tenants.id],
  }),
  workflow: one(workflows, {
    fields: [jobs.workflowId],
    references: [workflows.id],
  }),
}));

// ============================================
// API_KEYS TABLE
// ✅ PHASE 5 — Tâche 15 : Authentification API par clé
// ============================================
export const apiKeys = pgTable(
  "api_keys",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
  },
  (table) => ({
    tenantIdIdx: index("api_keys_tenant_id_idx").on(table.tenantId),
    keyIdx: index("api_keys_key_idx").on(table.key),
  })
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(tenants, {
    fields: [apiKeys.tenantId],
    references: [tenants.id],
  }),
}));

// Export sélectif de schema-campaigns pour éviter les conflits avec campaigns défini ci-dessus
export { 
  campaignStatusEnum, 
  campaignTypeEnum, 
  prospectStatusEnum,
  campaignProspects,
  campaignProspectsRelations
} from "./schema-campaigns";
