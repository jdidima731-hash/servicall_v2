import { describe, it, expect } from "vitest";
import axios from "axios";

/**
 * Action 3 – Test automatique obligatoire
 * Vérifie que toute route /api/* inexistante renvoie du JSON 404
 */
describe("API JSON Enforcement", () => {
  const baseUrl = `http://localhost:${process.env.PORT || 3000}`;

  it("should return 404 and application/json for a non-existent API route", async () => {
    try {
      await axios.get(`${baseUrl}/api/route-qui-nexiste-pas`);
    } catch (error: any) {
      // On s'attend à une erreur 404
      expect(error.response.status).toBe(404);
      
      // Vérification du Content-Type (Action 2)
      expect(error.response.headers["content-type"]).toContain("application/json");
      
      // Vérification de la structure du corps (Action 1)
      expect(error.response.data).toEqual({
        error: {
          type: "NOT_FOUND",
          message: expect.stringContaining("not found"),
        },
      });
    }
  });
});
