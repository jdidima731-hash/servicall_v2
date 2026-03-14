import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import * as Sentry from "@sentry/react";

interface TenantContextType {
  tenantId: number | null;
  setTenantId: (id: number | null) => void;
  isReady: boolean;
  requireTenantId: () => number;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenantId, setTenantIdState] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;

    // ✅ Bloc 9: Attacher l'utilisateur à Sentry
    if (isAuthenticated && user) {
      Sentry.setUser({ id: String(user.id), email: user.email });
    } else {
      Sentry.setUser(null);
    }

    // Si l'utilisateur n'est pas authentifié, pas besoin de tenantId
    if (!isAuthenticated) {
      setIsReady(true);
      return;
    }

    // Essayer de récupérer le tenantId depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlTenantId = urlParams.get('tenantId');

    if (urlTenantId) {
      const parsedId = parseInt(urlTenantId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        setTenantIdState(parsedId);
        localStorage.setItem('currentTenantId', parsedId.toString());
        setIsReady(true);
        return;
      }
    }

    // Essayer de récupérer depuis localStorage
    const storedTenantId = localStorage.getItem('currentTenantId');
    if (storedTenantId) {
      const parsedId = parseInt(storedTenantId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        setTenantIdState(parsedId);
        setIsReady(true);
        return;
      }
    }

    // Si l'utilisateur est authentifié mais n'a pas de tenantId, rediriger
    if (isAuthenticated && user) {
      console.warn('[TenantContext] Aucun tenantId trouvé, redirection vers sélection entreprise');
      setIsReady(true);
      // ✅ BLOC 1: Redirection vers la page de sélection d'entreprise
      setLocation('/select-tenant');
    }
  }, [user, isAuthenticated, loading, setLocation]);

  const setTenantId = (id: number | null) => {
    setTenantIdState(id);
    if (id !== null) {
      localStorage.setItem('currentTenantId', id.toString());
      // ✅ Bloc 9: Attacher le tenantId à Sentry
      Sentry.setTag("tenantId", String(id));
      Sentry.setContext("tenant", { id });
    } else {
      localStorage.removeItem('currentTenantId');
      Sentry.setTag("tenantId", null);
    }
  };

  const requireTenantId = (): number => {
    if (tenantId === null) {
      throw new Error('tenantId est requis mais non défini. Veuillez sélectionner une entreprise.');
    }
    return tenantId;
  };

  return (
    <TenantContext.Provider value={{ tenantId, setTenantId, isReady, requireTenantId }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant doit être utilisé dans un TenantProvider');
  }
  return context;
}
