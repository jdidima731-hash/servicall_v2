import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./infrastructure/logger";
import { RealtimeVoicePipeline } from "./services/realtimeVoicePipeline";
import { appRouter } from "./routers";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./_core/context";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// tRPC middleware
app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/voice-stream' });

/**
 * Robust WebSocket Session Management
 * Prevents OOM (Out Of Memory) by cleaning up resources automatically.
 */
const activeSessions = new Map<string, RealtimeVoicePipeline>();

wss.on('connection', (ws: WebSocket) => {
  let callId: string | null = null;
  let pipeline: RealtimeVoicePipeline | null = null;

  logger.info('[WebSocket] New connection established');

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'start':
          callId = data.start.callSid;
          const streamSid = data.start.streamSid;
          
          logger.info('[WebSocket] Call started', { callId, streamSid });

          // Initialize Voice Pipeline
          pipeline = new RealtimeVoicePipeline(ws, {
            callId: callId!,
            streamSid: streamSid,
            callSid: callId!,
            tenantId: data.start.customParameters?.tenantId ?? 1,
          });

          activeSessions.set(callId!, pipeline);
          await pipeline.start();
          break;

        case 'media':
          if (pipeline) {
            await pipeline.processAudio(data.media.payload);
          }
          break;

        case 'stop':
          logger.info('[WebSocket] Call stopped', { callId });
          cleanupSession(callId);
          break;
      }
    } catch (error: unknown) {
      logger.error('[WebSocket] Error processing message', { error });
    }
  });

  ws.on('close', () => {
    logger.info('[WebSocket] Connection closed', { callId });
    cleanupSession(callId);
  });

  ws.on('error', (error) => {
    logger.error('[WebSocket] Connection error', { callId, error });
    cleanupSession(callId);
  });

  /**
   * Cleanup Session and Resources
   * Essential for VPS stability with limited memory.
   */
  function cleanupSession(id: string | null) {
    if (id && activeSessions.has(id)) {
      const p = activeSessions.get(id);
      if (p) {
        p.stop().catch(e => logger.error('Error stopping pipeline', e));
      }
      activeSessions.delete(id);
      logger.info('[WebSocket] Session cleaned up', { callId: id });
    }
    
    // Force garbage collection if available (requires --expose-gc)
    if (global.gc) {
      global.gc();
    }
  }
});

// Periodic cleanup of stale sessions (safety net)
setInterval(() => {
  // Monitor memory usage
  const memoryUsage = process.memoryUsage();
  if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
    logger.warn('[System] High memory usage detected, performing emergency cleanup', {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
    });
  }
}, 60000);

const PORT = parseInt(process.env["PORT"] ?? '5000', 10);
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`[Server] Voice AI Server running on port ${PORT}`);
});
