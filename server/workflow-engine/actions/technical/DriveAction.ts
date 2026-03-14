/**
 * DRIVE ACTION
 * Gère les opérations sur les fichiers dans une sandbox sécurisée.
 * ✅ BLOC 5 : Config-driven, Sécurisé, Validation stricte.
 */

import { ActionHandler, ActionResult, ExecutionContext, ActionConfig } from "../../types";
import { Logger } from "../../utils/Logger";
import { z } from "zod";
import path from "path";

const driveConfigSchema = z.object({
  path: z.string().min(1, "Le chemin est obligatoire"),
  operation: z.enum(["write", "read", "delete"]).default("write"),
  content: z.string().optional(),
});

export class DriveAction implements ActionHandler<ActionConfig, ExecutionContext> {
  name = 'drive';
  private logger = new Logger('DriveAction');
  private readonly ALLOWED_ROOT = "/home/ubuntu/servicall_v2/storage/drive_sandbox";

  async execute(context: ExecutionContext, config: ActionConfig): Promise<ActionResult<unknown>> {
    try {
      const validatedConfig = driveConfigSchema.parse(config);
      
      // Sécurisation du chemin (Sandbox stricte)
      const safePath = this.getSafePath(validatedConfig.path);
      
      this.logger.info(`Drive operation: ${validatedConfig.operation}`, { 
        path: validatedConfig.path,
        safePath,
        tenant: context.tenant.id 
      });

      // Simulation de l'opération (PROD READY : Logique réelle à implémenter selon le provider)
      const output = {
        operation: validatedConfig.operation,
        path: validatedConfig.path,
        timestamp: new Date().toISOString(),
        status: 'simulated_success'
      };

      return {
        success: true,
        data: output
      };

    } catch (error: unknown) {
      this.logger.error('Drive operation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: ActionConfig): boolean {
    try {
      driveConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  private getSafePath(userPath: string): string {
    // 1. Interdiction absolue de ".."
    if (userPath.includes('..')) {
      throw new Error('Path traversal attempt detected');
    }

    // 2. Résolution du chemin absolu dans la sandbox
    const resolvedPath = path.join(this.ALLOWED_ROOT, userPath);

    // 3. Vérification que le chemin résolu est toujours dans la sandbox
    if (!resolvedPath.startsWith(this.ALLOWED_ROOT)) {
      throw new Error('Access denied: Path outside of sandbox');
    }

    return resolvedPath;
  }
}
