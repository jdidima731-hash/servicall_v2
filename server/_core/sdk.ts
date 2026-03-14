import { ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { AuthService, AuthenticatedUser } from "../services/authService";

/**
 * SDK Server - Gestion locale des sessions SECURISEE
 */

export type SessionPayload = {
  openId: string;
  name: string;
};

class SDKServer {
  private getSessionSecret() {
    const secret = process.env["JWT_SECRET"];
    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET is not configured or too weak");
    }
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return await new SignJWT({ openId, name: options.name ?? "" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setJti(crypto.randomUUID()) // Protection contre le replay
      .sign(secretKey);
  }

  async verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
    if (!token) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });
      
      const { openId, name } = payload as Record<string, unknown>;
      if (!openId || typeof openId !== "string") return null;

      return { openId, name: (name as string) || "" };
    } catch (error: unknown) {
      return null;
    }
  }

  /**
   * Authentifie une requete via le cookie de session
   */
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const authResult = await AuthService.authenticateRequest(req);
    if (!authResult) {
      throw new ForbiddenError("Invalid or expired session");
    }
    return authResult.user;
  }
}

export const sdk = new SDKServer();
