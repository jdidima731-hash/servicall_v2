import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Ajouter un ID unique à chaque requête
  req.id = uuidv4();
  req.startTime = Date.now();

  // Log de la requête entrante
  logger.info({
    type: 'request',
    id: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params
  });

  // Intercepter la réponse pour logger
  const originalSend = res.json;
  res.json = function(body) {
    const responseTime = Date.now() - req.startTime;
    
    logger.info({
      type: 'response',
      id: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      body: body
    });

    return originalSend.call(this, body);
  };

  next();
}
