/**
 * Environment Variables Validation Service (PRODUCTION GRADE)
 * ✅ DURCISSEMENT SaaS: Centralisation sur assertEnvOrCrash
 */

import { logger } from "../infrastructure/logger";
import { assertEnvOrCrash } from "../_core/env";

/**
 * Validate environment and exit if critical errors
 * ✅ DURCISSEMENT SaaS: Utilise la logique centralisée de ENV
 */
export async function validateEnvironmentOrExit(): Promise<void> {
  logger.info("[EnvValidation] Démarrage de la validation stricte via assertEnvOrCrash...");
  await assertEnvOrCrash();
  logger.info("[EnvValidation] ✅ Validation réussie");
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`La variable d'environnement requise ${name} n'est pas définie`);
  }
  return value;
}

export function getOptionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : defaultValue;
}
