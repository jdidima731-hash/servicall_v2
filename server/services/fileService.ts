import { logger } from "../infrastructure/logger";
import { getDb } from "../db";
import { documents } from "../../drizzle/schema";
import { storageService } from "./storage";

/**
 * File Service - Gestion du stockage via StorageService
 */
export class FileService {
  /**
   * Initialiser les répertoires de stockage
   */
  static async init() {
    await storageService.init();
  }

  /**
   * Sauvegarder un fichier pour un tenant spécifique
   */
  static async saveFile(params: {
    tenantId: number;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
    type: "photo" | "scan" | "contract" | "id_card" | "other";
    prospectId?: number;
    propertyId?: number;
  }) {
    try {
      const { key, url } = await storageService.saveFile({
        tenantId: params.tenantId,
        fileName: params.fileName,
        buffer: params.buffer,
        mimeType: params.mimeType
      });

      // Enregistrer en base de données
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [newDoc] = await db.insert(documents).values({
        tenantId: params.tenantId,
        prospectId: params.prospectId,
        propertyId: params.propertyId,
        name: params.fileName,
        type: params.type,
        fileUrl: url,
        mimeType: params.mimeType,
        size: params.buffer.length,
      });

      logger.info(`[FileService] File saved: ${url} for tenant ${params.tenantId}`);
      return { id: newDoc.insertId, fileUrl: url, key };
    } catch (error: unknown) {
      logger.error("[FileService] Error saving file", error);
      throw error;
    }
  }

  /**
   * Supprimer un fichier
   */
  static async deleteFile(docId: number, _tenantId: number) {
    try {
      const db = await getDb();
      if (!db) return;

      // TODO: Récupérer la clé depuis la DB et appeler storageService.deleteFile(key)
      logger.info(`[FileService] Delete requested for doc ${docId}`);
    } catch (error: unknown) {
      logger.error("[FileService] Error deleting file", error);
    }
  }
}
