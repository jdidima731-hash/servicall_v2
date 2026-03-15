import { Server } from 'socket.io';
import { eq } from 'drizzle-orm';
import { logger } from './utils/logger.js';
import { calls } from '../shared/schema.js';

export const setupWebSocket = (io: Server, db: any) => {
  io.on('connection', (socket) => {
    logger.info(`🔌 Nouvelle connexion WebSocket: ${socket.id}`);

    // Rejoindre une room d'organisation
    socket.on('join-organization', (organizationId: string) => {
      socket.join(`org:${organizationId}`);
      logger.info(`Socket ${socket.id} a rejoint l'organisation ${organizationId}`);
    });

    // Quitter une organisation
    socket.on('leave-organization', (organizationId: string) => {
      socket.leave(`org:${organizationId}`);
      logger.info(`Socket ${socket.id} a quitté l'organisation ${organizationId}`);
    });

    // Nouvel appel
    socket.on('new-call', async (callData: any) => {
      try {
        // Sauvegarder l'appel dans la DB
        const newCall = await db.insert(calls).values(callData).returning();
        
        // Notifier tous les membres de l'organisation
        io.to(`org:${callData.organizationId}`).emit('call-created', newCall[0]);
        
        logger.info(`Nouvel appel créé: ${newCall[0].id}`);
      } catch (error) {
        logger.error('Erreur lors de la création de l\'appel:', error);
        socket.emit('error', { message: 'Erreur lors de la création de l\'appel' });
      }
    });

    // Mise à jour d'appel
    socket.on('update-call', async ({ callId, updates }) => {
      try {
        const updatedCall = await db.update(calls)
          .set(updates)
          .where(eq(calls.id, callId))
          .returning();

        // Notifier l'organisation
        if (updatedCall[0]) {
          io.to(`org:${updatedCall[0].organizationId}`).emit('call-updated', updatedCall[0]);
        }
      } catch (error) {
        logger.error('Erreur lors de la mise à jour de l\'appel:', error);
      }
    });

    // Call en direct (streaming)
    socket.on('call-stream', ({ callId, audioData }) => {
      // Transmettre l'audio aux autres participants
      socket.broadcast.to(`call:${callId}`).emit('call-stream', audioData);
    });

    // Rejoindre un appel spécifique
    socket.on('join-call', (callId: string) => {
      socket.join(`call:${callId}`);
      logger.info(`Socket ${socket.id} a rejoint l'appel ${callId}`);
    });

    // Quitter un appel
    socket.on('leave-call', (callId: string) => {
      socket.leave(`call:${callId}`);
      logger.info(`Socket ${socket.id} a quitté l'appel ${callId}`);
    });

    // Typing indicator
    socket.on('typing', ({ callId, isTyping }) => {
      socket.broadcast.to(`call:${callId}`).emit('user-typing', {
        userId: socket.id,
        isTyping
      });
    });

    // Déconnexion
    socket.on('disconnect', () => {
      logger.info(`🔌 Déconnexion WebSocket: ${socket.id}`);
    });
  });

  // Statistiques en temps réel (toutes les 30 secondes)
  setInterval(async () => {
    try {
      const activeCalls = await db.select().from(calls).where(eq(calls.status, 'in-progress'));
      io.emit('stats', {
        activeCalls: activeCalls.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des stats:', error);
    }
  }, 30000);
}
