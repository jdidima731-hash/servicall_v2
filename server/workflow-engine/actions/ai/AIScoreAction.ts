/**
 * AI SCORE ACTION
 * Utilise le service scoringService existant du projet
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { calculateLeadScore } from "../../../services/scoringService";
import { updateProspect, getDb, prospects } from "../../../db";
import { eq } from "drizzle-orm";
import { Logger } from "../../utils/Logger";

// Configuration structurée
const AIScoreConfigSchema = z.object({
  prospectId: z.number().optional(),
});
type AIScoreConfig = z.infer<typeof AIScoreConfigSchema>;

// Résultat structuré
interface AIScoreResult {
  score: number;
  qualification: string;
}

export class AIScoreAction implements ActionHandler<AIScoreConfig, FinalExecutionContext, AIScoreResult> {
  name = "ai_score";
  private logger = new Logger("AIScoreAction");

  async execute(
    context: FinalExecutionContext,
    config: AIScoreConfig
  ): Promise<ActionResult<AIScoreResult>> {
    try {
      // Accès typé via les variables structurées
      const prospectId: number | undefined =
        context.variables.prospect?.id ?? config.prospectId;

      if (!prospectId) {
        return { success: false, error: "No prospect ID found for scoring" };
      }

      const db = await getDb();
      const prospectExists = await db
        .select()
        .from(prospects)
        .where(eq(prospects.id, prospectId))
        .limit(1);

      if (prospectExists.length === 0) {
        return { success: false, error: `Prospect ${prospectId} not found` };
      }

      const scoreResult = await calculateLeadScore(prospectId);

      const existingMetadata =
        (context.variables.prospect?.metadata as Record<string, unknown> | undefined) ?? {};

      await updateProspect(prospectId, {
        metadata: {
          ...existingMetadata,
          ai_score: scoreResult.score,
          ai_qualification: scoreResult.qualification
        }
      });

      // Mise à jour du contexte structuré
      context.variables.ai_score = scoreResult.score;
      if (context.variables.prospect) {
        context.variables.prospect.status = scoreResult.qualification;
      }

      return {
        success: true,
        data: {
          score: scoreResult.score,
          qualification: scoreResult.qualification
        }
      };
    } catch (error: unknown) {
      this.logger.error("Failed to calculate AI score", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(_config: Record<string, unknown>): boolean {
    return true;
  }
}
