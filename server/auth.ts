import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from './index.js';
import { users } from '../shared/schema.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

export const setupAuth = (app: any) => {
  // Stratégie locale
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase())
        });

        if (!user) {
          return done(null, false, { message: 'Email ou mot de passe incorrect' });
        }

        if (!user.isActive) {
          return done(null, false, { message: 'Compte désactivé' });
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return done(null, false, { message: 'Compte temporairement verrouillé' });
        }

        const isValid = await argon2.verify(user.passwordHash, password);
        
        if (!isValid) {
          // Incrémenter les tentatives
          await db.update(users)
            .set({ 
              loginAttempts: (user.loginAttempts || 0) + 1,
              lockedUntil: (user.loginAttempts || 0) >= 5 ? 
                new Date(Date.now() + 15 * 60 * 1000) : null
            })
            .where(eq(users.id, user.id));
          
          return done(null, false, { message: 'Email ou mot de passe incorrect' });
        }

        // Reset des tentatives
        await db.update(users)
          .set({ 
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date()
          })
          .where(eq(users.id, user.id));

        return done(null, user);
      } catch (error) {
        logger.error('Erreur authentification:', error);
        return done(error);
      }
    }
  ));

  // Stratégie JWT
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.jwtSecret
  }, async (payload, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, payload.sub)
      });

      if (!user || !user.isActive) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  }));

  // Sérialisation
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id)
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Fonctions utilitaires
  app.locals.hashPassword = async (password: string) => {
    const salt = randomBytes(32);
    return argon2.hash(password, { salt });
  };

  app.locals.generateToken = (userId: string) => {
    return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
  };
};
