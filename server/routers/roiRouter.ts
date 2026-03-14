/**
 * BLOC 5 - ROI & Onboarding Router
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { ROIService } from "../services/roiService";
import { tenantProcedure } from "../procedures";

export const roiRouter = router({
  /**
   * Obtenir les métriques ROI
   */
  getMetrics: tenantProcedure
    .input(z.object({
      tenantId: z.number(),
      days: z.number().default(30),
    }))
    .query(async ({ input }) => {
      return await ROIService.calculateTenantROI(input.tenantId, input.days);
    }),

  /**
   * Obtenir l'état de l'onboarding (simulé pour le MVP)
   */
  getOnboardingStatus: tenantProcedure
    .input(z.object({
      tenantId: z.number(),
    }))
    .query(async () => {
      return [
        { id: "rls", title: "Sécurité RLS activée", completed: true, importance: "high" },
        { id: "messaging", title: "Messagerie Multi-envoi configurée", completed: true, importance: "high" },
        { id: "shadow", title: "Shadow Agent (IA Proactive) actif", completed: true, importance: "medium" },
        { id: "copilot", title: "Copilote Temps Réel testé", completed: false, importance: "medium" },
        { id: "export", title: "Export Cloud (Drive) configuré", completed: true, importance: "low" },
      ];
    }),
});
