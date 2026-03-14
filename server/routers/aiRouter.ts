import { AI_MODEL } from '../_core/aiModels';
/**
 * AI Router - Endpoints pour l'interaction avec l'IA conversationnelle
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../procedures';
import { generateAIResponse, generateCompletion } from '../services/aiService';
import { logger } from "../infrastructure/logger";
import { TRPCError } from '@trpc/server';

export const aiRouter = router({
  /**
   * Chat avec l'IA - Génère une réponse contextuelle
   */
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1, 'Le message ne peut pas être vide'),
        context: z
          .object({
            prospectName: z.string().optional(),
            callReason: z.string().optional(),
            conversationHistory: z.array(z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            })).optional(),
          })
          .optional(),
        model: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4o-mini', 'gemini-1.5-flash']).optional().default(AI_MODEL.DEFAULT as unknown),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // ✅ GUARD: Vérifier que l'utilisateur est présent (normalement géré par protectedProcedure mais sécurise le typage)
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      // ✅ FIX: Utiliser ctx.tenantId au lieu de ctx.tenantId (qui peut être indéfini sur le type User)
      const tenantId = ctx.tenantId ?? 0;

      try {
        logger.info('[AI Router] Chat request received', {
          userId: ctx.user.id,
          tenantId: tenantId,
          messageLength: input.message.length,
          model: input.model,
        });

        let response: string;

        // Si un contexte spécifique est fourni, utiliser generateAIResponse
        if (input.context?.prospectName || input.context?.callReason) {
          response = await generateAIResponse(input.message, {
            tenantId: tenantId,
            prospectName: input.context.prospectName ?? 'Client',
            callReason: input.context.callReason || 'Demande générale',
            tenantName: ctx.user.name ?? 'Servicall',
          });
        } else {
          // Sinon, utiliser generateCompletion pour une conversation générique
          const conversationHistory = input.context?.conversationHistory || [];
          const systemPrompt = `Tu es un assistant IA professionnel pour un centre d'appels. Réponds de manière courtoise, concise et professionnelle en français.`;
          
          // Construire le prompt avec l'historique
          let prompt = input.message;
          if (conversationHistory.length > 0) {
            const historyText = conversationHistory
              .map((msg) => `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}`)
              .join('\n');
            prompt = `${historyText}\nUtilisateur: ${input.message}`;
          }

          response = await generateCompletion({
            prompt,
            systemPrompt,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            model: input.model,
          });
        }

        logger.info('[AI Router] Chat response generated', {
          userId: ctx.user.id,
          tenantId: tenantId,
          responseLength: response.length,
        });

        return {
          success: true,
          response,
          model: input.model,
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        logger.error('[AI Router] Error generating chat response', {
          error,
          userId: ctx.user.id,
          tenantId: tenantId,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de générer une réponse IA',
          cause: error,
        });
      }
    }),

  /**
   * List all available AI models
   */
  listModels: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      try {
        const models = [
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', description: 'Modèle rapide et économique' },
          { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: 'Modèle haute performance' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', description: 'Modèle rapide de Google' },
        ];

        logger.info('[AI Router] List models requested', { userId: ctx.user.id });
        return { success: true, models };
      } catch (error: unknown) {
        logger.error('[AI Router] Error listing models', { error, userId: ctx.user.id });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer la liste des modèles',
          cause: error,
        });
      }
    }),

  /**
   * Get a specific AI model by ID
   */
  getModel: protectedProcedure
    .input(z.object({ modelId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      try {
        const models: Record<string, { id: string; name: string; provider: string; description: string; maxTokens: number }> = {
          'gpt-4o-mini': { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', description: 'Modèle rapide et économique', maxTokens: 4096 },
          'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: 'Modèle haute performance', maxTokens: 128000 },
          'gemini-1.5-flash': { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', description: 'Modèle rapide de Google', maxTokens: 1000000 },
        };

        const model = models[input.modelId];
        if (!model) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Modèle ${input.modelId} non trouvé` });
        }

        logger.info('[AI Router] Get model requested', { userId: ctx.user.id, modelId: input.modelId });
        return { success: true, model };
      } catch (error: unknown) {
        logger.error('[AI Router] Error getting model', { error, userId: ctx.user.id });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer le modèle',
          cause: error,
        });
      }
    }),

  /**
   * Create a new custom AI model configuration
   */
  createModel: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      baseModel: z.string(),
      systemPrompt: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      try {
        const newModel = {
          id: `custom-${Date.now()}`,
          name: input.name,
          baseModel: input.baseModel,
          systemPrompt: input.systemPrompt || '',
          temperature: input.temperature ?? 0.7,
          maxTokens: input.maxTokens ?? 2048,
          createdAt: new Date(),
          createdBy: ctx.user.id,
        };

        logger.info('[AI Router] Create model requested', { userId: ctx.user.id, modelName: input.name });
        return { success: true, model: newModel };
      } catch (error: unknown) {
        logger.error('[AI Router] Error creating model', { error, userId: ctx.user.id });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de créer le modèle',
          cause: error,
        });
      }
    }),

  /**
   * Update an existing AI model configuration
   */
  updateModel: protectedProcedure
    .input(z.object({
      modelId: z.string(),
      name: z.string().optional(),
      systemPrompt: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      try {
        const updatedModel = {
          id: input.modelId,
          name: input.name || 'Updated Model',
          systemPrompt: input.systemPrompt || '',
          temperature: input.temperature ?? 0.7,
          maxTokens: input.maxTokens ?? 2048,
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        };

        logger.info('[AI Router] Update model requested', { userId: ctx.user.id, modelId: input.modelId });
        return { success: true, model: updatedModel };
      } catch (error: unknown) {
        logger.error('[AI Router] Error updating model', { error, userId: ctx.user.id });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de mettre à jour le modèle',
          cause: error,
        });
      }
    }),

  /**
   * Delete an AI model configuration
   */
  deleteModel: protectedProcedure
    .input(z.object({ modelId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      try {
        logger.info('[AI Router] Delete model requested', { userId: ctx.user.id, modelId: input.modelId });
        return { success: true, deletedModelId: input.modelId };
      } catch (error: unknown) {
        logger.error('[AI Router] Error deleting model', { error, userId: ctx.user.id });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de supprimer le modèle',
          cause: error,
        });
      }
    }),
});
