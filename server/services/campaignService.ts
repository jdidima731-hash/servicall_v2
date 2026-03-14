/**
 * Campaign Service - Orchestration des campagnes multi-flux
 * Gère la logique spécifique à chaque type de campagne (Call, SMS, WhatsApp).
 */

import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

export class CampaignService {
  /**
   * Récupérer une campagne par son ID
   */
  static async getCampaignById(campaignId: number) {
    const db = await getDb();
    const [campaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    return campaign;
  }

  /**
   * Récupérer les campagnes pour un tenant
   */
  static async getCampaigns(tenantId: number, options: { limit?: number; offset?: number; status?: string } = {}) {
    const { limit = 50, offset = 0, status } = options;
    const db = await getDb();
    
    let query = db.select().from(schema.campaigns).where(eq(schema.campaigns.tenantId, tenantId));
    
    if (status) {
      query = db.select().from(schema.campaigns).where(
        and(
          eq(schema.campaigns.tenantId, tenantId),
          eq(schema.campaigns.status, status as unknown)
        )
      ) as unknown;
    }

    return await (query as unknown)
      .orderBy(schema.campaigns.createdAt)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Créer une nouvelle campagne
   */
  static async createCampaign(data: typeof schema.campaigns.$inferInsert) {
    const db = await getDb();
    logger.info(`[Campaign] Creating new campaign: ${data.name}`, { type: data.type });
    const [newCampaign] = await db.insert(schema.campaigns).values(data).returning();
    return newCampaign;
  }

  /**
   * Mettre à jour une campagne
   */
  static async updateCampaign(campaignId: number, data: Partial<typeof schema.campaigns.$inferInsert>) {
    const db = await getDb();
    logger.info(`[Campaign] Updating campaign ${campaignId}`, { campaignId, fields: Object.keys(data) });
    return await db
      .update(schema.campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.campaigns.id, campaignId))
      .returning();
  }

  /**
   * Changer l'état d'une campagne
   */
  static async updateStatus(campaignId: number, status: "draft" | "ready" | "active" | "paused" | "completed") {
    return await this.updateCampaign(campaignId, { status });
  }

  /**
   * Ajouter des prospects à une campagne
   */
  static async addProspects(campaignId: number, prospectIds: number[]) {
    logger.info(`[Campaign] Adding ${prospectIds.length} prospects to campaign ${campaignId}`);
    // TODO: campaignProspects table not defined in schema
    // const _values = prospectIds.map(prospectId => ({ campaignId, prospectId, status: 'pending' as const }));
    // return await db.insert(schema.campaignProspects).values(_values).returning();
    void campaignId;
    return [];
  }

  /**
   * Récupérer les prospects d'une campagne
   */
  static async getCampaignProspects(campaignId: number) {
    const db = await getDb();
    return await db
      .select({
        id: schema.campaignProspects.id,
        status: schema.campaignProspects.status,
        prospect: schema.prospects
      })
      .from(schema.campaignProspects)
      .innerJoin(schema.prospects, eq(schema.campaignProspects.prospectId, schema.prospects.id))
      .where(eq(schema.campaignProspects.campaignId, campaignId));
  }
}
