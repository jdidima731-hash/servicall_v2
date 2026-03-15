import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { users, calls, organizations } from '../shared/schema.js';
import { logger } from './utils/logger.js';
import { authenticateJWT } from './middleware/auth.js';

export const setupRoutes = (db: any) => {
  const router = Router();

  // Health check
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Users routes
  router.get('/users', authenticateJWT, async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      logger.error('Error fetching users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/users/:id', authenticateJWT, async (req, res) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.params.id)
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      logger.error('Error fetching user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Calls routes
  router.get('/calls', authenticateJWT, async (req, res) => {
    try {
      const allCalls = await db.select().from(calls);
      res.json(allCalls);
    } catch (error) {
      logger.error('Error fetching calls:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/calls', authenticateJWT, async (req, res) => {
    try {
      const newCall = await db.insert(calls).values({
        ...req.body,
        userId: (req.user as any).id
      }).returning();
      res.status(201).json(newCall[0]);
    } catch (error) {
      logger.error('Error creating call:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Organizations routes
  router.get('/organizations', authenticateJWT, async (req, res) => {
    try {
      const orgs = await db.select().from(organizations);
      res.json(orgs);
    } catch (error) {
      logger.error('Error fetching organizations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
