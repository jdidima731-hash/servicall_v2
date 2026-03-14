import { useEffect, useState, useCallback } from "react";

/**
 * Hook centralisé pour la gestion du token CSRF
 * Récupère automatiquement le token depuis le serveur et le stocke en mémoire globale
 * 
 * @returns {string | null} Le token CSRF ou null si non disponible
 */
export function useCsrfToken(): string | null {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const fetchCsrfToken = useCallback(async () => {
    try {
      const response = await fetch("/api/csrf-token", {
        credentials: "include",
      });
      
      if (!response.ok) {
        console.error("[CSRF] Erreur serveur lors de la récupération du token");
        return;
      }

      const data = await response.json();
      
      // ✅ FIX: Toujours utiliser le token s'il est présent (csrfEnabled est toujours true)
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        setCsrfTokenGlobal(data.csrfToken);
        console.info("[CSRF_MONITOR] Token initialisé avec succès");
      } else {
        console.warn("[CSRF_MONITOR] Aucun token CSRF reçu du serveur");
        setCsrfToken(null);
        setCsrfTokenGlobal(null);
      }
    } catch (error) {
      console.error("[CSRF] Erreur réseau lors de la récupération du token:", error);
      setCsrfToken(null);
      setCsrfTokenGlobal(null);
    }
  }, []);

  useEffect(() => {
    fetchCsrfToken();
  }, [fetchCsrfToken]);

  return csrfToken;
}

/**
 * Fonction utilitaire pour obtenir le token CSRF depuis le store global
 * Utilisée par la configuration tRPC (main.tsx) pour injecter automatiquement le header x-csrf-token
 */
export function getCsrfToken(): string | null {
  return (window as any).__CSRF_TOKEN__ || null;
}

/**
 * Fonction pour stocker le token CSRF dans le store global
 */
export function setCsrfTokenGlobal(token: string | null): void {
  (window as any).__CSRF_TOKEN__ = token;
}

/**
 * ✅ CORRECTION CRITIQUE BUG CSRF POST-LOGIN
 * Rafraîchit le token CSRF depuis le serveur (nouvelle session après login)
 * et met à jour le store global immédiatement.
 * Doit être appelé AVANT toute navigation post-login.
 */
export async function refreshCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/csrf-token", {
      credentials: "include",
      // Forcer le bypass du cache navigateur pour obtenir un token lié à la nouvelle session
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[CSRF] Échec du rafraîchissement du token CSRF", response.status);
      return null;
    }

    const data = await response.json();

    if (data.csrfToken) {
      setCsrfTokenGlobal(data.csrfToken);
      console.info("[CSRF_MONITOR] Token rafraîchi avec succès");
      return data.csrfToken;
    }

    return null;
  } catch (error) {
    console.error("[CSRF] Erreur réseau lors du rafraîchissement du token:", error);
    return null;
  }
}
