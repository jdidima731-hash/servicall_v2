/**
 * CSP Nonce Middleware - Génération de nonces sécurisés pour Content Security Policy
 * Permet de supprimer 'unsafe-inline' en production
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      nonce?: string;
    }
    interface Response {
      locals: {
        nonce?: string;
      };
    }
  }
}

/**
 * Génère un nonce unique pour chaque requête
 * Le nonce doit être ajouté à tous les <script> et <style> inline
 */
export function cspNonceMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Générer un nonce cryptographiquement sécurisé
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Stocker le nonce dans req et res.locals pour y accéder dans les vues
  req.nonce = nonce;
  res.locals['nonce'] = nonce;
  
  next();
}

/**
 * Récupère le nonce de la requête courante
 */
export function getNonce(req: Request): string | undefined {
  return req.nonce;
}
