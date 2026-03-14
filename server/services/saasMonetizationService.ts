/**
 * SaaS Monetization Service
 * Gestion des plans d'abonnement et des feature flags
 * ✅ PHASE 10 — Monétisation
 */

import { logger } from "../infrastructure/logger";
import * as db from "../db";
import { eq } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

export type SubscriptionPlan = "starter" | "pro" | "enterprise";

export interface PlanFeatures {
  crm: boolean;
  leads: boolean;
  dashboard: boolean;
  workflowsBasic: boolean;
  workflowsAdvanced: boolean;
  recruitmentAI: boolean;
  socialMediaAutomation: boolean;
  voiceAI: boolean;
  analyticsAdvanced: boolean;
  customIntegrations: boolean;
  dedicatedSupport: boolean;
}

export interface SubscriptionQuota {
  maxAgents: number;
  maxCalls: number;
  maxLeads: number;
  maxWorkflows: number;
  maxAutomations: number;
  storageGB: number;
}

export interface SaaSPlan {
  id: SubscriptionPlan;
  name: string;
  description: string;
  priceMonthly: number; // en euros
  priceYearly: number;
  features: PlanFeatures;
  quotas: SubscriptionQuota;
}

const SAAS_PLANS: Record<SubscriptionPlan, SaaSPlan> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Pour les petites équipes et PME",
    priceMonthly: 99,
    priceYearly: 990,
    features: {
      crm: true,
      leads: true,
      dashboard: true,
      workflowsBasic: true,
      workflowsAdvanced: false,
      recruitmentAI: false,
      socialMediaAutomation: false,
      voiceAI: false,
      analyticsAdvanced: false,
      customIntegrations: false,
      dedicatedSupport: false,
    },
    quotas: {
      maxAgents: 5,
      maxCalls: 1000,
      maxLeads: 5000,
      maxWorkflows: 10,
      maxAutomations: 50,
      storageGB: 10,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Pour les entreprises en croissance",
    priceMonthly: 299,
    priceYearly: 2990,
    features: {
      crm: true,
      leads: true,
      dashboard: true,
      workflowsBasic: true,
      workflowsAdvanced: true,
      recruitmentAI: true,
      socialMediaAutomation: true,
      voiceAI: true,
      analyticsAdvanced: true,
      customIntegrations: false,
      dedicatedSupport: false,
    },
    quotas: {
      maxAgents: 50,
      maxCalls: 10000,
      maxLeads: 50000,
      maxWorkflows: 100,
      maxAutomations: 500,
      storageGB: 100,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Pour les grandes organisations",
    priceMonthly: 999,
    priceYearly: 9990,
    features: {
      crm: true,
      leads: true,
      dashboard: true,
      workflowsBasic: true,
      workflowsAdvanced: true,
      recruitmentAI: true,
      socialMediaAutomation: true,
      voiceAI: true,
      analyticsAdvanced: true,
      customIntegrations: true,
      dedicatedSupport: true,
    },
    quotas: {
      maxAgents: 500,
      maxCalls: 100000,
      maxLeads: 500000,
      maxWorkflows: 1000,
      maxAutomations: 5000,
      storageGB: 1000,
    },
  },
};

/**
 * Service de Monétisation SaaS
 */
export class SaaSMonetizationService {
  /**
   * Récupère un plan par ID
   */
  getPlan(planId: SubscriptionPlan): SaaSPlan | null {
    return SAAS_PLANS[planId] || null;
  }

  /**
   * Récupère tous les plans disponibles
   */
  getAllPlans(): SaaSPlan[] {
    return Object.values(SAAS_PLANS);
  }

  /**
   * Vérifie si une feature est activée pour un tenant
   */
  async isFeatureEnabled(
    tenantId: number,
    feature: keyof PlanFeatures
  ): Promise<boolean> {
    try {
      const tenant = await db.db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (!tenant[0]) {
        logger.warn("[SaaS] Tenant not found", { tenantId });
        return false;
      }

      const plan = this.getPlan((tenant[0] as unknown).subscriptionPlan ?? "starter");
      if (!plan) {
        logger.warn("[SaaS] Plan not found", { planId: (tenant[0] as unknown).subscriptionPlan });
        return false;
      }

      return plan.features[feature];
    } catch (error: unknown) {
      logger.error("[SaaS] Error checking feature", { error, tenantId, feature });
      return false;
    }
  }

  /**
   * Vérifie si un quota est respecté
   */
  async checkQuota(
    tenantId: number,
    quotaType: keyof SubscriptionQuota,
    currentUsage: number
  ): Promise<boolean> {
    try {
      const tenant = await db.db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (!tenant[0]) {
        logger.warn("[SaaS] Tenant not found", { tenantId });
        return false;
      }

      const plan = this.getPlan((tenant[0] as unknown).subscriptionPlan ?? "starter");
      if (!plan) {
        logger.warn("[SaaS] Plan not found", { planId: (tenant[0] as unknown).subscriptionPlan });
        return false;
      }

      const limit = plan.quotas[quotaType];
      const isWithinQuota = currentUsage <= limit;

      if (!isWithinQuota) {
        logger.warn("[SaaS] Quota exceeded", {
          tenantId,
          quotaType,
          currentUsage,
          limit,
        });
      }

      return isWithinQuota;
    } catch (error: unknown) {
      logger.error("[SaaS] Error checking quota", { error, tenantId, quotaType });
      return false;
    }
  }

  /**
   * Upgrade un tenant vers un nouveau plan
   */
  async upgradePlan(tenantId: number, newPlan: SubscriptionPlan): Promise<boolean> {
    try {
      logger.info("[SaaS] Upgrading plan", { tenantId, newPlan });

      const plan = this.getPlan(newPlan);
      if (!plan) {
        throw new Error(`Plan ${newPlan} not found`);
      }

      await db.db
        .update(schema.tenants)
        .set({ subscriptionPlan: newPlan as unknown })
        .where(eq(schema.tenants.id, tenantId));

      logger.info("[SaaS] Plan upgraded successfully", { tenantId, newPlan });
      return true;
    } catch (error: unknown) {
      logger.error("[SaaS] Error upgrading plan", { error, tenantId });
      return false;
    }
  }
}

/**
 * Instance singleton du service de Monétisation SaaS
 */
export const saasMonetizationService = new SaaSMonetizationService();
