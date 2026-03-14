/**
 * BLOC 3 - Tests Shadow Agent
 * Vérifie que l'IA respecte les règles de bridage
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ShadowAgentService } from "../services/shadowAgentService";
import { dbManager } from "../services/dbManager";
import * as schema from "../../drizzle/schema";

describe("Shadow Agent - BLOC 3", () => {
  let tenantId: number;
  let prospectId: number;
  let callId: number;

  beforeAll(async () => {
    const db = dbManager.db;

    // Créer un tenant de test
    const [tenant] = await db.insert(schema.tenants).values({
      slug: "test-shadow-agent",
      name: "Test Shadow Agent",
      isActive: true,
    }).returning();
    tenantId = tenant.id;

    // Créer un prospect de test
    const [prospect] = await db.insert(schema.prospects).values({
      tenantId,
      firstName: "John",
      lastName: "Doe",
      phone: "+33612345678",
      status: "new",
    }).returning();
    prospectId = prospect.id;

    // Créer un appel manqué
    const [call] = await db.insert(schema.calls).values({
      tenantId,
      prospectId,
      callType: "outbound",
      outcome: "no_answer",
      status: "completed",
      duration: 0,
    }).returning();
    callId = call.id;
  });

  afterAll(async () => {
    const db = dbManager.db;

    // Nettoyer les données de test
    if (callId) {
      await db.delete(schema.calls).where(schema.calls.id.equals(callId));
    }
    if (prospectId) {
      await db.delete(schema.prospects).where(schema.prospects.id.equals(prospectId));
    }
    if (tenantId) {
      await db.delete(schema.tenants).where(schema.tenants.id.equals(tenantId));
    }
  });

  it("Détecte les appels manqués et génère des suggestions", async () => {
    const suggestions = await ShadowAgentService.detectMissedCallsAndSuggest(tenantId);

    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBe(true);
    
    if (suggestions.length > 0) {
      const suggestion = suggestions[0];
      expect(suggestion.tenantId).toBe(tenantId);
      expect(suggestion.prospectId).toBe(prospectId);
      expect(suggestion.type).toBe("missed_call_followup");
      expect(suggestion.status).toBe("pending");
    }
  });

  it("Les suggestions générées ne contiennent PAS de mots interdits", async () => {
    const suggestions = await ShadowAgentService.detectMissedCallsAndSuggest(tenantId);

    const forbiddenKeywords = [
      "prix", "tarif", "coût", "payer", "payement",
      "contrat", "engagement", "signer",
      "€", "$"
    ];

    suggestions.forEach(suggestion => {
      const content = suggestion.suggestedAction.content?.toLowerCase() || "";
      
      forbiddenKeywords.forEach(keyword => {
        expect(content).not.toContain(keyword);
      });
    });
  });

  it("Les suggestions sont en statut 'pending' par défaut", async () => {
    const suggestions = await ShadowAgentService.detectMissedCallsAndSuggest(tenantId);

    suggestions.forEach(suggestion => {
      expect(suggestion.status).toBe("pending");
    });
  });

  it("Récupère les suggestions en attente", async () => {
    const pending = await ShadowAgentService.getPendingSuggestions(tenantId);

    expect(pending).toBeDefined();
    expect(Array.isArray(pending)).toBe(true);
    
    pending.forEach(suggestion => {
      expect(suggestion.status).toBe("pending");
      expect(suggestion.tenantId).toBe(tenantId);
    });
  });

  it("Refuse une modification contenant des mots interdits", async () => {
    const suggestions = await ShadowAgentService.getPendingSuggestions(tenantId);
    
    if (suggestions.length > 0) {
      const suggestionId = suggestions[0].id!;
      
      const result = await ShadowAgentService.modifySuggestion(
        suggestionId,
        tenantId,
        "Bonjour, voici notre prix : 99€ par mois"
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("mots interdits");
    }
  });

  it("Accepte une modification sans mots interdits", async () => {
    const suggestions = await ShadowAgentService.getPendingSuggestions(tenantId);
    
    if (suggestions.length > 0) {
      const suggestionId = suggestions[0].id!;
      
      const result = await ShadowAgentService.modifySuggestion(
        suggestionId,
        tenantId,
        "Bonjour, pouvons-nous vous rappeler ?"
      );

      expect(result.success).toBe(true);
    }
  });

  it("L'IA ne peut PAS envoyer de message sans approbation humaine", async () => {
    const db = dbManager.db;
    
    // Vérifier qu'aucun message n'a été envoyé automatiquement
    const messages = await db
      .select()
      .from(schema.messages)
      .where(schema.messages.tenantId.equals(tenantId));

    // Les messages créés par le Shadow Agent doivent être en statut 'pending'
    // et nécessitent une approbation explicite
    const autoSentMessages = messages.filter(m => 
      m.status === "sent" && !m.externalSid?.startsWith("approved_")
    );

    expect(autoSentMessages.length).toBe(0);
  });
});
