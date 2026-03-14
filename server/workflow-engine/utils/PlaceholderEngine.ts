/**
 * PLACEHOLDER ENGINE
 * Moteur centralisé et sécurisé de résolution des placeholders.
 * ✅ BLOC 6 : {var} et {{var}}, Résolution runtime, Sécurité absolue.
 */
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "./Logger";

type Resolvable = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];

export class PlaceholderEngine {
  private static logger = new Logger("PlaceholderEngine");

  /**
   * Résout les placeholders dans un objet de configuration ou une chaîne.
   */
  static resolve(config: Resolvable, context: FinalExecutionContext): Resolvable {
    if (config === null || config === undefined) return config;
    if (typeof config === "string") {
      return this.resolveString(config, context);
    }
    if (Array.isArray(config)) {
      return config.map(item => this.resolve(item as Resolvable, context));
    }
    if (typeof config === "object") {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        resolved[key] = this.resolve(value as Resolvable, context);
      }
      return resolved;
    }
    return config;
  }

  /**
   * Résout les placeholders dans une chaîne de caractères.
   * Supporte {var} et {{var}}.
   */
  private static resolveString(str: string, context: FinalExecutionContext): string {
    return str.replace(/\{\{?([^}]+)\}?\}/g, (_match, path: string) => {
      const trimmedPath = path.trim();
      const parts = trimmedPath.split(".");

      // ✅ PROTECTION : Allowlist de racines autorisées
      const allowedRoots: ReadonlyArray<string> = [
        "prospect", "caller", "event", "ai", "variables", "tenant", "call",
        "firstName", "lastName", "email", "phone", "last_message", "transcription",
        "ai_score", "ai_summary", "business_entities", "appointment", "visit", "property"
      ];

      const root = parts[0];
      if (!root || !allowedRoots.includes(root)) {
        this.logger.error(`Accès à une racine non autorisée : ${root ?? 'undefined'}`);
        throw new Error(`Security Violation: Access to variable "${root ?? 'undefined'}" is forbidden in placeholders`);
      }

      // Résolution de la racine à partir du contexte structuré
      let value: unknown;
      switch (root) {
        case 'event':
          value = context.event;
          break;
        case 'tenant':
          value = context.tenant;
          break;
        case 'prospect':
          value = context.variables.prospect;
          break;
        case 'call':
          value = context.variables.call;
          break;
        case 'ai':
          value = context.variables.ai;
          break;
        case 'variables':
          value = context.variables;
          break;
        default:
          // Accès direct aux propriétés de premier niveau des variables
          value = context.variables[root];
          break;
      }

      // Navigation dans le chemin restant (ex: prospect.firstName → parts[1] = 'firstName')
      const remainingParts = parts.slice(1);
      for (const part of remainingParts) {
        if (value === undefined || value === null) break;
        value = (value as Record<string, unknown>)[part];
      }

      if (value === undefined || value === null) {
        this.logger.warn(`Variable manquante ou nulle : ${trimmedPath}`);
        return "";
      }

      return String(value);
    });
  }
}
