import type { AuthenticatedUser } from '../services/authService';

// Déclarations de types globaux pour le backend

declare module 'ioredis-mock' {
  import Redis from 'ioredis';
  const RedisMock: typeof Redis;
  export default RedisMock;
}

declare module 'tw-animate-css' {
  const content: unknown;
  export default content;
}

declare module '@sentry/node' {
  export const init: (options: unknown) => void;
  export const captureException: (error: unknown) => void;
  export const captureMessage: (message: string) => void;
}

// Types pour les modules internes
declare module '*/loggingService' {
  export interface LogContext {
    [key: string]: unknown;
    status?: number;
  }
  export const logger: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      googleAccessToken?: string;
    }
  }
}
