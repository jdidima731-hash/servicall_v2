/**
 * Request Validation Middleware
 * Valide les requêtes POST/PUT/PATCH avec Zod
 */

import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { logger } from "../infrastructure/logger";
import { AppError, ErrorType } from "./errorHandler";

/**
 * Crée un middleware de validation pour le body
 */
export function validateBody(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      logger.warn("[Validation] Body validation failed", {
        path: req.path,
        method: req.method,
        error: error.message,
      });

      throw new AppError(
        ErrorType.VALIDATION,
        "Invalid request body",
        400,
        error.errors || error.message
      );
    }
  };
}

/**
 * Crée un middleware de validation pour les query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error: any) {
      logger.warn("[Validation] Query validation failed", {
        path: req.path,
        method: req.method,
        error: error.message,
      });

      throw new AppError(
        ErrorType.VALIDATION,
        "Invalid query parameters",
        400,
        error.errors || error.message
      );
    }
  };
}

/**
 * Crée un middleware de validation pour les params
 */
export function validateParams(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error: any) {
      logger.warn("[Validation] Params validation failed", {
        path: req.path,
        method: req.method,
        error: error.message,
      });

      throw new AppError(
        ErrorType.VALIDATION,
        "Invalid URL parameters",
        400,
        error.errors || error.message
      );
    }
  };
}

/**
 * Middleware de validation générique pour tous les types
 */
export function validate(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as any;
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as any;
      }
      next();
    } catch (error: any) {
      logger.warn("[Validation] Request validation failed", {
        path: req.path,
        method: req.method,
        error: error.message,
      });

      throw new AppError(
        ErrorType.VALIDATION,
        "Invalid request",
        400,
        error.errors || error.message
      );
    }
  };
}
