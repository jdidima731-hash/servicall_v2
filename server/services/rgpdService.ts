/**
 * BLOC 4 : Service RGPD - Droit à l'Oubli (Article 17)
 * Implémente la suppression et l'anonymisation des données personnelles
 */

import { dbManager } from "./dbManager";
import { logger } from "../infrastructure/logger";
import { prospects, users, calls, messages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export class RGPDService {
  /**
   * Implémenter le droit à l'oubli (Article 17 RGPD)
   * Anonymiser les données personnelles d'un prospect ou d'un utilisateur
   */
  static async deleteUserData(userId: number, tenantId: number): Promise<void> {
    try {
      logger.info("[RGPD] Starting user data anonymization", { userId, tenantId });

      // Utiliser le contexte tenant pour garantir l'isolation
      await dbManager.withTenantContext(tenantId, async (tx) => {
        // 1. Anonymiser l'utilisateur lui-même s'il s'agit d'un compte utilisateur
        await tx.update(users)
          .set({
            name: "Utilisateur Supprimé",
            email: `deleted_${userId}_${Date.now()}@anonymized.local`,
            passwordHash: "DELETED",
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        // 2. Anonymiser les prospects associés à cet utilisateur (si créateur)
        // Note: On garde les enregistrements pour l'intégrité des stats mais on retire le PII
        await tx.update(prospects)
          .set({
            firstName: "ANONYME",
            lastName: "ANONYME",
            email: "deleted@anonymized.local",
            phone: "DELETED",
            notes: "Données supprimées suite à une demande RGPD",
            updatedAt: new Date(),
          })
          .where(and(
            eq(prospects.tenantId, tenantId),
            eq(prospects.assignedTo, userId)
          ));

        // 3. Nettoyer les métadonnées des appels
        await tx.update(calls)
          .set({
            transcription: "[SUPPRIMÉ PAR RGPD]",
            summary: "[SUPPRIMÉ PAR RGPD]",
            recordingUrl: null,
            recordingKey: null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(calls.tenantId, tenantId),
            eq(calls.agentId, userId)
          ));

        // 4. Supprimer les messages personnels
        await tx.update(messages)
          .set({
            content: "[MESSAGE SUPPRIMÉ PAR RGPD]",
            updatedAt: new Date(),
          })
          .where(and(
            eq(messages.tenantId, tenantId),
            eq(messages.prospectId, userId) // Si le prospect est l'utilisateur
          ));
      });

      logger.info("[RGPD] User data anonymization completed successfully", {
        userId,
        tenantId,
        timestamp: new Date().toISOString(),
      });

      // Envoyer une confirmation
      await this.sendDeletionConfirmationEmail(userId);
    } catch (error: unknown) {
      logger.error("[RGPD] Error during user data anonymization", { error, userId, tenantId });
      throw error;
    }
  }

  /**
   * Exporter les données d'un utilisateur (Article 20 RGPD)
   */
  static async exportUserData(userId: number, tenantId: number): Promise<Record<string, any>> {
    try {
      logger.info("[RGPD] Exporting user data", { userId, tenantId });

      return await dbManager.withTenantContext(tenantId, async (tx) => {
        const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
        const userProspects = await tx.select().from(prospects).where(eq(prospects.assignedTo, userId));
        const userCalls = await tx.select().from(calls).where(eq(calls.agentId, userId));

        const exportData = {
          user: user[0] || null,
          prospects: userProspects,
          calls: userCalls,
          exportedAt: new Date().toISOString(),
          tenantId,
        };

        logger.info("[RGPD] User data exported successfully", { 
          userId, 
          prospectCount: userProspects.length 
        });
        
        return exportData;
      });
    } catch (error: unknown) {
      logger.error("[RGPD] Error exporting user data", { error, userId });
      throw error;
    }
  }

  private static async sendDeletionConfirmationEmail(userId: number): Promise<void> {
    // Logique d'envoi d'email (simulée ici)
    logger.info("[RGPD] Deletion confirmation email sent", { userId });
  }
}
