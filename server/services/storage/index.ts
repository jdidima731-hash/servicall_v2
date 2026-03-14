import { IStorageService } from "./IStorageService";
import { LocalStorageService } from "./LocalStorageService";
import { ForgeStorageService } from "./ForgeStorageService";
import { logger } from "../../infrastructure/logger";

class StorageFactory {
  private static instance: IStorageService;

  static getInstance(): IStorageService {
    if (!this.instance) {
      const useForge = process.env['STORAGE_TYPE'] === "forge" || 
                       (!!process.env['AWS_ACCESS_KEY_ID'] && !!process.env['AWS_SECRET_ACCESS_KEY']);
      
      if (useForge) {
        logger.info("[StorageFactory] Using ForgeStorageService");
        this.instance = new ForgeStorageService();
      } else {
        logger.info("[StorageFactory] Using LocalStorageService (default)");
        this.instance = new LocalStorageService();
      }
    }
    return this.instance;
  }
}

export const storageService = StorageFactory.getInstance();
export * from "./IStorageService";
export * from "./LocalStorageService";
export * from "./ForgeStorageService";
