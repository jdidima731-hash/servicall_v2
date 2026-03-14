import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../services/passwordService";

describe("Auth Service (Password)", () => {
  it("should hash and verify password correctly", async () => {
    const password = "SecurePass123!";
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
    
    const isInvalid = await verifyPassword("WrongPass", hash);
    expect(isInvalid).toBe(false);
  });

  it("should validate password strength correctly", () => {
    // Trop court
    expect(validatePasswordStrength("Short1!").valid).toBe(false);
    
    // Pas de chiffre
    expect(validatePasswordStrength("NoNumber!").valid).toBe(false);
    
    // Pas de majuscule
    expect(validatePasswordStrength("nouppercase1!").valid).toBe(false);
    
    // Pas de caractère spécial
    expect(validatePasswordStrength("NoSpecialChar123").valid).toBe(false);
    
    // Mot de passe commun
    expect(validatePasswordStrength("Password123!").valid).toBe(false);
    
    // Valide
    const result = validatePasswordStrength("Strong_Pass_2026!");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
