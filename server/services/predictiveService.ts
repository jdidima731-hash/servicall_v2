import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { predictiveScores, InsertPredictiveScore, customerInvoices, callScoring } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

/**
 * Service d'IA prédictive V1
 * Prédit la probabilité d'acceptation, délai de paiement, canal optimal, etc.
 */

export class PredictiveService {
  /**
   * Calcule la probabilité d'acceptation d'une facture
   * Basé sur: score de l'appel, historique du prospect, montant
   */
  private static async calculateAcceptanceProbability(
    prospectId?: number,
    invoiceAmount?: number,
    callScore?: number
  ): Promise<number> {
    let probability = 0.5; // Base 50%

    // Facteur 1: Score de l'appel (si disponible)
    if (callScore !== undefined) {
      if (callScore >= 80) probability += 0.3;
      else if (callScore >= 60) probability += 0.2;
      else if (callScore >= 40) probability += 0.1;
      else probability -= 0.1;
    }

    // Facteur 2: Historique du prospect
    if (prospectId) {
      const db = await getDb();
      if (db) {
        // Compter les factures précédentes acceptées
        const previousInvoices = await db
          .select()
          .from(customerInvoices)
          .where(eq(customerInvoices.prospectId, prospectId));

        const acceptedCount = previousInvoices.filter((inv: unknown) => inv.status === "accepted").length;
        const totalCount = previousInvoices.length;

        if (totalCount > 0) {
          const acceptanceRate = acceptedCount / totalCount;
          probability = probability * 0.5 + acceptanceRate * 0.5; // Moyenne pondérée
        }
      }
    }

    // Facteur 3: Montant de la facture (les petits montants sont plus facilement acceptés)
    if (invoiceAmount !== undefined) {
      if (invoiceAmount < 100) probability += 0.1;
      else if (invoiceAmount > 1000) probability -= 0.1;
    }

    return Math.max(0, Math.min(1, probability)); // Clamp entre 0 et 1
  }

  /**
   * Estime le délai de paiement en jours
   */
  private static async estimatePaymentDelay(
    prospectId?: number,
    invoiceAmount?: number
  ): Promise<number> {
    let delay = 15; // Délai moyen par défaut: 15 jours

    // Facteur 1: Historique du prospect
    if (prospectId) {
      const db = await getDb();
      if (db) {
        const paidInvoices = await db
          .select()
          .from(customerInvoices)
          .where(and(
            eq(customerInvoices.prospectId, prospectId),
            eq(customerInvoices.paymentStatus, "paid")
          ));

        if (paidInvoices.length > 0) {
          // Calculer le délai moyen historique
          let totalDelay = 0;
          let count = 0;

          for (const invoice of paidInvoices) {
            if (invoice.sentAt && invoice.paidAt) {
              const sentDate = new Date(invoice.sentAt);
              const paidDate = new Date(invoice.paidAt);
              const delayDays = Math.floor((paidDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
              totalDelay += delayDays;
              count++;
            }
          }

          if (count > 0) {
            delay = Math.round(totalDelay / count);
          }
        }
      }
    }

    // Facteur 2: Montant (les gros montants prennent plus de temps)
    if (invoiceAmount !== undefined) {
      if (invoiceAmount > 1000) delay += 5;
      if (invoiceAmount > 5000) delay += 10;
    }

    return Math.max(1, delay); // Minimum 1 jour
  }

  /**
   * Recommande le meilleur canal de communication
   */
  private static recommendChannel(_prospectId?: number): "email" | "whatsapp" | "sms" {
    // Pour V1, on recommande email par défaut
    // En V2, on pourrait analyser l'historique des interactions
    return "email";
  }

  /**
   * Recommande le meilleur moment pour envoyer
   */
  private static recommendTime(): string {
    // Pour V1, on recommande les heures ouvrables
    return "09:00-11:00 ou 14:00-16:00";
  }

  /**
   * Calcule la probabilité de succès global
   */
  private static calculateSuccessProbability(
    acceptanceProbability: number,
    paymentDelay: number
  ): number {
    // Si forte probabilité d'acceptation et délai court, succès élevé
    let successProb = acceptanceProbability;

    if (paymentDelay < 10) successProb += 0.1;
    else if (paymentDelay > 30) successProb -= 0.1;

    return Math.max(0, Math.min(1, successProb));
  }

  /**
   * Identifie les facteurs de risque
   */
  private static identifyRiskFactors(
    acceptanceProbability: number,
    paymentDelay: number,
    invoiceAmount?: number
  ): string[] {
    const risks: string[] = [];

    if (acceptanceProbability < 0.5) {
      risks.push("Faible probabilité d'acceptation");
    }

    if (paymentDelay > 30) {
      risks.push("Délai de paiement potentiellement long");
    }

    if (invoiceAmount && invoiceAmount > 5000) {
      risks.push("Montant élevé");
    }

    if (risks.length === 0) {
      risks.push("Aucun risque identifié");
    }

    return risks;
  }

  /**
   * Estime le temps de traitement du workflow
   */
  private static estimateProcessingTime(callScore?: number): number {
    // Temps en secondes
    let time = 300; // 5 minutes par défaut

    if (callScore !== undefined) {
      if (callScore >= 80) time = 180; // 3 minutes pour les bons appels
      else if (callScore < 40) time = 600; // 10 minutes pour les appels difficiles
    }

    return time;
  }

  /**
   * Génère une prédiction complète pour une facture
   */
  static async predictForInvoice(invoiceId: number): Promise<boolean> {
    try {
      const db = await getDb();
      if (!db) {
        logger.error("[PredictiveService] Database not available");
        return false;
      }

      // Récupérer la facture
      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        logger.error("[PredictiveService] Invoice not found", { invoiceId });
        return false;
      }

      const invoice = invoiceResults[0];

      // Récupérer le score de l'appel si disponible
      let callScore: number | undefined;
      if (invoice.callId) {
        const scoreResults = await db
          .select()
          .from(callScoring)
          .where(eq(callScoring.callId, invoice.callId))
          .limit(1);

        if (scoreResults.length > 0) {
          callScore = scoreResults[0].finalScore || undefined;
        }
      }

      // Calculer les prédictions
      const probabilityAcceptance = await this.calculateAcceptanceProbability(
        invoice.prospectId || undefined,
        parseFloat(invoice.amount as unknown),
        callScore
      );

      const estimatedPaymentDelay = await this.estimatePaymentDelay(
        invoice.prospectId || undefined,
        parseFloat(invoice.amount as unknown)
      );

      const estimatedProcessingTime = this.estimateProcessingTime(callScore);
      const recommendedChannel = this.recommendChannel(invoice.prospectId || undefined);
      const recommendedTime = this.recommendTime();
      const successProbability = this.calculateSuccessProbability(probabilityAcceptance, estimatedPaymentDelay);
      const riskFactors = this.identifyRiskFactors(
        probabilityAcceptance,
        estimatedPaymentDelay,
        parseFloat(invoice.amount as unknown)
      );

      // Enregistrer la prédiction
      const predictionData: InsertPredictiveScore = {
        tenantId: invoice.tenantId,
        prospectId: invoice.prospectId,
        invoiceId,
        probabilityAcceptance: probabilityAcceptance.toString() as unknown,
        estimatedPaymentDelay,
        estimatedProcessingTime,
        recommendedChannel,
        recommendedTime,
        successProbability: successProbability.toString() as unknown,
        riskFactors,
      };

      await db.insert(predictiveScores).values(predictionData);

      logger.info("[PredictiveService] Prediction generated", {
        invoiceId,
        probabilityAcceptance,
        estimatedPaymentDelay,
        successProbability,
      });

      return true;
    } catch (error: unknown) {
      logger.error("[PredictiveService] Failed to generate prediction", { error, invoiceId });
      return false;
    }
  }

  /**
   * Récupère la prédiction pour une facture
   */
  static async getPrediction(invoiceId: number) {
    try {
      const db = await getDb();
      if (!db) return null;

      const results = await db
        .select()
        .from(predictiveScores)
        .where(eq(predictiveScores.id, invoiceId))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error: unknown) {
      logger.error("[PredictiveService] Failed to get prediction", { error, invoiceId });
      return null;
    }
  }

  /**
   * Met à jour la prédiction avec le résultat réel
   */
  static async updateActualOutcome(
    invoiceId: number,
    outcome: "accepted" | "rejected" | "paid"
  ): Promise<boolean> {
    try {
      const db = await getDb();
      if (!db) return false;

      const prediction = await this.getPrediction(invoiceId);
      if (!prediction) return false;

      // Calculer la précision
      let accuracy = 0;
      if (outcome === "accepted" || outcome === "paid") {
        const predicted = parseFloat(prediction.probabilityAcceptance as unknown);
        accuracy = predicted; // Si accepté, la précision = probabilité prédite
      } else {
        const predicted = parseFloat(prediction.probabilityAcceptance as unknown);
        accuracy = 1 - predicted; // Si rejeté, la précision = 1 - probabilité prédite
      }

      await db
        .update(predictiveScores)
        .set({
          actualOutcome: outcome,
          accuracy: accuracy.toString() as unknown,
          updatedAt: new Date(),
        })
        .where(eq(predictiveScores.id, prediction.id));

      logger.info("[PredictiveService] Actual outcome recorded", { invoiceId, outcome, accuracy });
      return true;
    } catch (error: unknown) {
      logger.error("[PredictiveService] Failed to update actual outcome", { error, invoiceId });
      return false;
    }
  }

  /**
   * Récupère les statistiques de précision du modèle
   */
  static async getModelAccuracy(tenantId: number): Promise<number> {
    try {
      const db = await getDb();
      if (!db) return 0;

      const predictions = await db
        .select()
        .from(predictiveScores)
        .where(and(
          eq(predictiveScores.tenantId, tenantId),
          // @ts-ignore
          eq(predictiveScores.actualOutcome, null)
        ));

      if (predictions.length === 0) return 0;

      const totalAccuracy = predictions.reduce((sum: number, pred: unknown) => {
        return sum + (parseFloat((pred as unknown).accuracy) || 0);
      }, 0);

      return totalAccuracy / predictions.length;
    } catch (error: unknown) {
      logger.error("[PredictiveService] Failed to get model accuracy", { error, tenantId });
      return 0;
    }
  }
}
