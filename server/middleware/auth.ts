import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { logger } from '../utils/logger.js';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: any, info: any) => {
    if (err) {
      logger.error('Erreur d\'authentification JWT:', err);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    req.user = user;
    next();
  })(req, res, next);
};

export const authenticateLocal = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', { session: true }, (err: any, user: any, info: any) => {
    if (err) {
      logger.error('Erreur d\'authentification locale:', err);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
    }

    if (!user) {
      return res.status(401).json({ error: info?.message || 'Email ou mot de passe incorrect' });
    }

    req.logIn(user, (err) => {
      if (err) {
        logger.error('Erreur de connexion:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
      }
      next();
    });
  })(req, res, next);
};

export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    
    if (!user) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    next();
  };
};

export const requireOrganization = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const organizationId = req.params.organizationId || req.body.organizationId;

  if (!organizationId) {
    return res.status(400).json({ error: 'ID d\'organisation requis' });
  }

  // Vérifier si l'utilisateur appartient à l'organisation
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, user.id)
    )
  });

  if (!member) {
    return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });
  }

  next();
}
