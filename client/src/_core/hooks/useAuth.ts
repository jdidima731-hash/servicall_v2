import { LOGIN_PATH } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";
import { encryptData } from "../utils/encryption";
import { isValidUser } from "@/lib/safeAccess";
import { toast } from "sonner";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/**
 * ✅ CORRECTION PRODUCTION-READY: Hook d'authentification avec validation stricte
 * Garantit que l'utilisateur a toujours une session complète (id, role, email)
 */
export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated: _redirectOnUnauthenticated = false, redirectPath: _redirectPath = LOGIN_PATH } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    // ✅ CORRECTION: Retry réduit pour affichage plus rapide (1 seule tentative)
    retry: (failureCount, error: any) => {
      // Ne pas retry les erreurs d'authentification (401 Unauthorized)
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
        return false;
      }
      // Retry max 1 fois pour les erreurs réseau
      return failureCount < 1;
    },
    // ✅ CORRECTION: Délai réduit (500ms)
    retryDelay: () => 500,
    // ✅ Bloc 9: Rafraîchir quand l'utilisateur revient sur la fenêtre
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      // ✅ TOAST: Feedback visuel de déconnexion
      toast.success("À bientôt ! Déconnexion réussie.");
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      // ✅ TOAST: Feedback visuel d'erreur lors du logout
      toast.error("Erreur lors de la déconnexion. Veuillez réessayer.");
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      // Nettoyer le localStorage
      localStorage.removeItem("manus-runtime-user-info");
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // ✅ CORRECTION CRITIQUE: Valider que l'utilisateur a une session complète
    let validUser = null;
    
    if (meQuery.data) {
      // Vérifier que l'utilisateur a toutes les propriétés requises
      if (isValidUser(meQuery.data)) {
        validUser = meQuery.data;
        
        // Sauvegarder dans le localStorage seulement si valide
        const encrypted = encryptData(meQuery.data);
        if (encrypted) {
          localStorage.setItem("manus-runtime-user-info", encrypted);
        }
      } else {
        // Session incomplète détectée
        console.error("[useAuth] Session incomplète détectée:", {
          id: (meQuery.data as any)?.id,
          role: (meQuery.data as any)?.role,
          email: (meQuery.data as any)?.email,
        });
        // Nettoyer le localStorage
        localStorage.removeItem("manus-runtime-user-info");
        
        // Invalider la session
        validUser = null;
      }
    } else {
      // Pas de données utilisateur
      localStorage.removeItem("manus-runtime-user-info");
    }

    return {
      user: validUser,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(validUser),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  // Suppression de l'effet de redirection automatique qui causait des boucles
  // La redirection est maintenant gérée au niveau des gardes de route (RBACGuard)
  // ou manuellement dans les composants si nécessaire.

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
