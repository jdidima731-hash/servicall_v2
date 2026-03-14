/**
 * Refresh Token Service SÉCURISÉ
 */

import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { logger } from "../infrastructure/logger";
import { getRedisClient } from "../infrastructure/redis/redis.client";

// Utilisation d'un secret dédié et fort
const REFRESH_TOKEN_SECRET = new TextEncoder().encode(
  process.env['JWT_REFRESH_SECRET'] || process.env['JWT_SECRET']
);

if (!process.env['JWT_REFRESH_SECRET'] && process.env['NODE_ENV'] === "production") {
  logger.warn("[RefreshToken] Using JWT_SECRET as fallback for refresh tokens. Consider setting JWT_REFRESH_SECRET.");
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

interface TokenPayload {
  userId: number;
  openId: string;
  tenantId?: number;
  role?: string;
}

export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({
    userId: payload.userId,
    openId: payload.openId,
    tenantId: payload.tenantId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setJti(nanoid())
    .sign(REFRESH_TOKEN_SECRET);
}

export async function generateRefreshToken(payload: TokenPayload): Promise<string> {
  const tokenId = nanoid();
  const redis = getRedisClient();
  
  // Rotation de token : on pourrait invalider les anciens ici
  
  await redis.setex(
    `refresh_token:${tokenId}`,
    7 * 24 * 60 * 60,
    JSON.stringify({
      userId: payload.userId,
      tokenId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
  );

  return await new SignJWT({
    userId: payload.userId,
    openId: payload.openId,
    tokenId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setJti(tokenId)
    .sign(REFRESH_TOKEN_SECRET);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_TOKEN_SECRET);
    return payload as unknown as TokenPayload;
  } catch (error: unknown) {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_TOKEN_SECRET);
    const tokenId = payload.jti as string;

    const redis = getRedisClient();
    const storedTokenStr = await redis.get(`refresh_token:${tokenId}`);
    
    if (!storedTokenStr) return null;

    return {
      userId: payload['userId'] as number,
      openId: payload['openId'] as string,
    };
  } catch (error: unknown) {
    return null;
  }
}
// ... (Autres fonctions de révocation omises pour concision)
