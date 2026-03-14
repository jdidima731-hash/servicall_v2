import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { HealthService } from "../services/healthService";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().optional(),
      }).optional()
    )
    .query(async () => {
      return await HealthService.getFullStatus();
    }),

  metrics: adminProcedure
    .query(() => {
      const { metrics: metricsService } = require("../services/metricsService");
      return metricsService.getStats();
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
