import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { InvoiceService } from "../services/invoiceService";
import { CallExecutionService } from "../services/callExecutionService";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";
import { tenantProcedure, adminProcedure } from "../procedures";
import { paginationInput, paginate } from "../_core/pagination";
import * as db from "../db";
import { count, eq } from "drizzle-orm";
import { customerInvoices } from "../../drizzle/schema";

/**
 * Router pour la gestion des factures clients
 */

export const invoiceRouter = router({
  /**
   * Crée une nouvelle facture avec calcul dynamique de la TVA
   */
  create: tenantProcedure
    .input(
      z.object({
        prospectId: z.number().int().positive().optional(),
        callId: z.number().int().positive().optional(),
        amount: z.number().positive("Le montant doit être positif"),
        taxRate: z.number().min(0).max(100).default(20), // Taux par défaut 20%
        description: z.string().optional(),
        template: z.string().optional(),
        prospectName: z.string().optional(), // ✅ FIX: Pour le mode démo
        prospectEmail: z.string().email().optional(), // ✅ FIX: Pour le mode démo
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        // Calcul dynamique HT -> TVA -> TTC
        const amountHT = input.amount;
        const taxAmount = (amountHT * input.taxRate) / 100;
        
        const invoiceId = await InvoiceService.createInvoice({
          tenantId: ctx.tenantId,
          prospectId: input.prospectId,
          callId: input.callId,
          amount: amountHT,
          tax: taxAmount,
          description: input.description || `Facture du ${new Date().toLocaleDateString("fr-FR")}`,
          template: input.template,
          prospectName: input.prospectName,
          prospectEmail: input.prospectEmail,
        });

        if (!invoiceId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erreur lors de la création de la facture",
          });
        }

        if (input.callId) {
          await CallExecutionService.recordInvoiceCreated(input.callId);
        }

        const invoice = await InvoiceService.getInvoiceById(invoiceId);

        return {
          success: true,
          invoiceId,
          invoice,
          summary: {
            ht: amountHT,
            tva: taxAmount,
            ttc: amountHT + taxAmount,
          }
        };
      } catch (error: unknown) {
        logger.error("[InvoiceRouter] Create failed", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur serveur lors de la facturation",
        });
      }
    }),

  /**
   * Liste les factures du tenant (customerInvoices)
   */
  list: tenantProcedure
    .input(paginationInput)
    .query(async ({ input, ctx }) => {
      const { page, limit } = input;
      const offset = (page - 1) * limit;
      
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }

      // ✅ FIX: En mode démo, ne pas appeler db.db.select() qui lancerait une exception
      const data = await InvoiceService.listInvoices(ctx.tenantId, limit, offset);
      let total = data.length;

      if (process.env['DB_ENABLED'] !== "false") {
        try {
          const totalResult = await db.db.select({ value: count() })
            .from(customerInvoices)
            .where(eq(customerInvoices.tenantId, ctx.tenantId));
          total = totalResult[0]?.value ?? data.length;
        } catch (_e) {
          total = data.length;
        }
      }

      return paginate(data, total, input);
    }),

  /**
   * Récupère une facture par ID
   */
  get: tenantProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const invoice = await InvoiceService.getInvoiceById(input.invoiceId);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      // Vérifier les permissions
      if (invoice.tenantId !== ctx.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      return invoice;
    }),

  /**
   * Envoie une facture par email
   */
  sendByEmail: tenantProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { invoiceId, email } = input;

      // Vérifier les permissions
      const invoice = await InvoiceService.getInvoiceById(invoiceId);
      if (!invoice || invoice.tenantId !== ctx.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const success = await InvoiceService.sendInvoiceByEmail(invoiceId, email);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send invoice by email",
        });
      }

      // Enregistrer dans les métriques si lié à un appel
      if (invoice.callId) {
        await CallExecutionService.recordInvoiceSent(invoice.callId);
      }

      return {
        success: true,
        message: "Invoice sent by email",
      };
    }),

  /**
   * Envoie une facture par WhatsApp
   */
  sendByWhatsApp: tenantProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        phone: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { invoiceId, phone } = input;

      // Vérifier les permissions
      const invoice = await InvoiceService.getInvoiceById(invoiceId);
      if (!invoice || invoice.tenantId !== ctx.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const success = await InvoiceService.sendInvoiceByWhatsApp(invoiceId, phone);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send invoice by WhatsApp",
        });
      }

      // Enregistrer dans les métriques si lié à un appel
      if (invoice.callId) {
        await CallExecutionService.recordInvoiceSent(invoice.callId);
      }

      return {
        success: true,
        message: "Invoice sent by WhatsApp",
      };
    }),

  /**
   * Accepte une facture (endpoint public avec token)
   */
  acceptInvoice: publicProcedure
    .input(
      z.object({
        token: z.string(),
        acceptedBy: z.string(),
        acceptedIP: z.string(),
        signatureData: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { token, acceptedBy, acceptedIP, signatureData } = input;

      const success = await InvoiceService.acceptInvoice(token, acceptedBy, acceptedIP, signatureData);

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to accept invoice. Token may be invalid or expired.",
        });
      }

      return {
        success: true,
        message: "Invoice accepted successfully",
      };
    }),

  /**
   * Valide un token de lien sécurisé
   */
  validateToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .query(async ({ input }) => {
      const validation = await InvoiceService.validateSecureLink(input.token);

      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired token",
        });
      }

      return {
        valid: true,
        invoice: validation.invoice,
      };
    }),

  /**
   * Récupère le statut d'une facture
   */
  getStatus: tenantProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const invoice = await InvoiceService.getInvoiceById(input.invoiceId);

      if (!invoice || invoice.tenantId !== ctx.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const status = await InvoiceService.getInvoiceStatus(input.invoiceId);

      return status;
    }),

  /**
   * Met à jour le statut de paiement
   */
  trackPayment: adminProcedure // Restricted to admin
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        status: z.enum(["pending", "paid", "failed"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { invoiceId, status } = input;

      // Vérifier les permissions
      const invoice = await InvoiceService.getInvoiceById(invoiceId);
      if (!invoice || invoice.tenantId !== ctx.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const success = await InvoiceService.trackPaymentStatus(invoiceId, status);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update payment status",
        });
      }

      return {
        success: true,
        status,
      };
    }),
});
