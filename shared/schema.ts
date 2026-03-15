import { pgTable, serial, text, timestamp, integer, boolean, jsonb, varchar, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table avec sécurité avancée
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  fullName: varchar('full_name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  mfaSecret: text('mfa_secret'),
  mfaEnabled: boolean('mfa_enabled').default(false),
  lastLoginAt: timestamp('last_login_at'),
  loginAttempts: integer('login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpires: timestamp('password_reset_expires'),
  emailVerificationToken: text('email_verification_token'),
  preferences: jsonb('preferences').default({}),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Organizations table (multi-tenant)
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  logo: text('logo'),
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  settings: jsonb('settings').default({}),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: varchar('subscription_status', { length: 50 }),
  trialEndsAt: timestamp('trial_ends_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organization members
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).default('member').notNull(),
  permissions: jsonb('permissions').default([]),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// Calls table (avec gestion d'appels)
export const calls = pgTable('calls', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  callerId: varchar('caller_id', { length: 20 }).notNull(),
  recipientId: varchar('recipient_id', { length: 20 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  duration: integer('duration'),
  recording: text('recording'),
  transcript: text('transcript'),
  notes: text('notes'),
  tags: text('tags').array(),
  metadata: jsonb('metadata').default({}),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Skills/Services table
export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  price: integer('price'), // en cents
  duration: integer('duration'), // en minutes
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  organizations: many(organizationMembers),
  calls: many(calls),
  createdSkills: many(skills),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  calls: many(calls),
  skills: many(skills),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  organization: one(organizations, {
    fields: [calls.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [calls.userId],
    references: [users.id],
  }),
}));

// Zod schemas pour validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email('Email invalide'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Format de téléphone invalide').optional(),
  passwordHash: z.string().min(60),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastLoginAt: true,
  loginAttempts: true,
  lockedUntil: true,
});

export const selectUserSchema = createSelectSchema(users).omit({
  passwordHash: true,
  salt: true,
  mfaSecret: true,
  passwordResetToken: true,
  emailVerificationToken: true,
});

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  mfaCode: z.string().length(6).optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Doit contenir une majuscule')
    .regex(/[a-z]/, 'Doit contenir une minuscule')
    .regex(/[0-9]/, 'Doit contenir un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Doit contenir un caractère spécial'),
  fullName: z.string().min(2, 'Nom trop court').optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Format de téléphone invalide').optional(),
});

export const createCallSchema = z.object({
  recipientId: z.string().min(1, 'Destinataire requis'),
  notes: z.string().optional(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Skill = typeof skills.$inferSelect;
[CONTINUÉ DANS LE PROCHAIN MESSAGE]

Ui
Je continue avec la suite des fichiers :
