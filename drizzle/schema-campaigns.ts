import { pgTable, varchar, integer, timestamp, text, boolean, json, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./schema";
import { prospects } from "./schema";

export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed", "archived"]);
export const campaignTypeEnum = pgEnum("campaign_type", ["outbound_predictive_dialer", "outbound_power_dialer", "inbound_ivr", "sms_blast", "email_sequence"]);
export const prospectStatusEnum = pgEnum("prospect_status", ["pending", "dialing", "completed", "failed", "scheduled"]);


export const campaigns = pgTable("campaigns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: campaignTypeEnum("type").notNull(),
  status: campaignStatusEnum("status").default("draft"),
  dialerSettings: json("dialer_settings"), // e.g., { pacing_ratio: 2.5, max_attempts: 3, retry_delay_s: 300 }
  schedule: json("schedule"), // e.g., { start_time: "09:00", end_time: "17:00", weekdays_only: true }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("campaigns_tenant_id_idx").on(table.tenantId),
  statusIdx: index("campaigns_status_idx").on(table.status),
}));

export const campaignProspects = pgTable("campaign_prospects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }), // Peut être null si le prospect n'existe pas encore dans la table prospects
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }),
  status: prospectStatusEnum("status").default("pending"),
  callAttempts: integer("call_attempts").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  scheduledAt: timestamp("scheduled_at"), // For scheduled callbacks
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  campaignProspectUniqueIdx: uniqueIndex("campaign_prospect_unique_idx").on(table.campaignId, table.prospectId),
  statusIdx: index("campaign_prospects_status_idx").on(table.status),
  scheduledAtIdx: index("campaign_prospects_scheduled_at_idx").on(table.scheduledAt),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  campaignProspects: many(campaignProspects),
}));

export const campaignProspectsRelations = relations(campaignProspects, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignProspects.campaignId],
    references: [campaigns.id],
  }),
  prospect: one(prospects, {
    fields: [campaignProspects.prospectId],
    references: [prospects.id],
  }),
}));
