import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('❌ Erreur:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Erreurs de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Erreur de validation',
      details: err.message
    });
  }

  // Erreurs d'authentification
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Non autorisé',
      details: err.message
    });
  }

  // Erreurs de base de données
  if (err.name === 'DatabaseError') {
    return res.status(503).json({
      error: 'Erreur de base de données',
      details: config.nodeEnv === 'production' ? undefined : err.message
    });
  }

  // Erreur par défaut
  res.status(500).json({
    error: 'Erreur interne du serveur',
    details: config.nodeEnv === 'production' ? undefined : err.message,
    requestId: req.id
  });
};

// Middleware pour les routes non trouvées
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn(`Route non trouvée: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
}
