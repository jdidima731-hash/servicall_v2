import { router } from "../_core/trpc";
import { z } from "zod";
import { CampaignService } from "../services/campaignService";
import { TRPCError } from "@trpc/server";
import { tenantProcedure, managerProcedure } from "../procedures";
import { normalizeResponse, normalizeDbRecords } from "../_core/responseNormalizer";
import { paginationInput, paginate } from "../_core/pagination";
import * as db from "../db";
import { count, eq } from "drizzle-orm";

export const campaignRouter = router({
  /**
   * List all campaigns for a tenant with pagination
   * ✅ Bloc 3: Performance optimisée
   */
  list: tenantProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      const [campaigns, totalResult] = await Promise.all([
        CampaignService.getCampaigns(ctx.tenantId, {
          limit,
          offset,
        }),
        db.db.select({ value: count() })
          .from(db.campaigns)
          .where(eq(db.campaigns.tenantId, ctx.tenantId))
      ]);

      const normalizedData = normalizeDbRecords(campaigns);
      return paginate(normalizedData, totalResult[0]?.value ?? 0, input);
    }),

  /**
   * Create a new campaign
   */
  create: managerProcedure
    .input(z.object({
      tenantId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      activityType: z.string().optional(),
      type: z.enum(["ai_qualification", "human_appointment", "hybrid_reception"]).optional().default("ai_qualification"),
      config: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const campaignData = {
          name: input.name,
          description: input.description,
          type: input.type,
          activityType: input.activityType ?? "prospection",
          tenantId: ctx.tenantId,
          status: "active",
          settings: input.config || {},
        };

        const campaign = await CampaignService.createCampaign(campaignData);
        return normalizeResponse(campaign, 'campaign.create');
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create campaign",
        });
      }
    }),
});
