import { describe, it, expect, beforeAll, afterAll } from "vitest";
import axios from "axios";
import express from "express";
import { expressErrorHandler } from "../middleware/errorHandler";
import { createServer, Server } from "http";

describe("Global Error Handling (Action 10)", () => {
  let app: express.Express;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    app = express();
    
    // Route de simulation d'erreur
    app.get("/test-error", (req, res) => {
      throw new Error("boom");
    });

    app.use(expressErrorHandler);

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  it("should return normalized JSON error when an error is thrown", async () => {
    try {
      await axios.get(`http://localhost:${port}/test-error`);
    } catch (error: any) {
      const response = error.response;
      
      expect(response.status).toBe(500);
      expect(response.headers["content-type"]).toContain("application/json");
      
      // Vérification du format (Action 8)
      expect(response.data.error).toBeDefined();
      expect(response.data.error.type).toBe("INTERNAL_ERROR");
      expect(response.data.error.message).toBe("boom");
      expect(response.data.error.correlationId).toBeDefined();
      
      // En mode test (NODE_ENV !== 'production'), la stack peut être présente, 
      // mais le format doit être respecté.
    }
  });
});
