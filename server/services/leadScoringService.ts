import { logger } from "../infrastructure/logger";
import { metrics } from "./metricsService";
import { BusinessInsights } from "./aiService";
import { AIScoringService } from "./aiScoring.service";
import { Sentiment } from "./aiScoring.config";

export interface ScoringFactors {
  sentiment: Sentiment;
  objectionsCount: number;
  intentions: string[];
  callDuration: number;
  interactionHistoryCount: number;
}

/**
 * Lead Scoring Service - Calcule le potentiel de conversion d'un prospect
 * Utilise AIScoringService pour une logique de scoring transparente et maîtrisée.
 */
class LeadScoringService {
  /**
   * Calculer le score de conversion (0-100)
   * @deprecated Utiliser AIScoringService.calculateLeadScore directement
   */
  calculateScore(factors: ScoringFactors): number {
    const result = AIScoringService.calculateLeadScore({
      sentiment: factors.sentiment,
      objectionsCount: factors.objectionsCount,
      intentions: factors.intentions,
      durationSeconds: factors.callDuration,
      historyCount: factors.interactionHistoryCount
    });
    return result.score;
  }

  /**
   * Mettre à jour le score d'un prospect suite à un appel
   */
  async updateProspectScore(
    prospectId: number,
    tenantId: number,
    insights: BusinessInsights,
    callDuration: number,
    historyCount: number
  ): Promise<number> {
    const scoringResult = AIScoringService.calculateLeadScore({
      sentiment: insights.sentiment as Sentiment,
      objectionsCount: insights.objections.length,
      intentions: insights.intentions,
      durationSeconds: callDuration,
      historyCount: historyCount
    });

    const score = scoringResult.score;

    // Simulation de mise à jour en DB
    logger.info(`[Lead Scoring] Prospect ${prospectId} score updated to ${score}`, {
      tenantId,
      prospectId,
      score
    });

    metrics.recordBusinessMetric("lead_score_updated", score, "score", tenantId);

    return score;
  }
}

export const leadScoringService = new LeadScoringService();
