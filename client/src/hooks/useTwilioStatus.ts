/**
 * BLOC 3 - Hook pour vérifier la disponibilité de Twilio
 * Permet d'afficher un mode dégradé si Twilio n'est pas configuré
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export interface TwilioStatus {
  isConfigured: boolean;
  isReady: boolean;
  hasToken: boolean;
  hasPhoneNumber: boolean;
  hasAgent: boolean;
  error: string | null;
  loading: boolean;
}

/**
 * Hook pour vérifier le statut de Twilio
 * @returns TwilioStatus
 */
export function useTwilioStatus(): TwilioStatus {
  const [status, setStatus] = useState<TwilioStatus>({
    isConfigured: false,
    isReady: false,
    hasToken: false,
    hasPhoneNumber: false,
    hasAgent: false,
    error: null,
    loading: true,
  });

  // Requête pour vérifier la configuration Twilio
  const { 
    data: twilioConfig, 
    isLoading, 
    isError, 
    error 
  } = trpc.softphone.checkTwilioConfig.useQuery(undefined, {
    retry: 1,
    staleTime: 60000, // Cache 1 minute
  });

  useEffect(() => {
    if (isLoading) {
      setStatus(prev => ({ ...prev, loading: true }));
      return;
    }

    if (isError) {
      setStatus({
        isConfigured: false,
        isReady: false,
        hasToken: false,
        hasPhoneNumber: false,
        hasAgent: false,
        error: error?.message || "Erreur lors de la vérification de Twilio",
        loading: false,
      });
      return;
    }

    if (twilioConfig) {
      const isReady = 
        twilioConfig.hasAccountSid &&
        twilioConfig.hasAuthToken &&
        twilioConfig.hasPhoneNumber;

      setStatus({
        isConfigured: twilioConfig.hasAccountSid && twilioConfig.hasAuthToken,
        isReady,
        hasToken: twilioConfig.hasAuthToken,
        hasPhoneNumber: twilioConfig.hasPhoneNumber,
        hasAgent: true, // TODO: Vérifier si l'agent a un numéro assigné
        error: null,
        loading: false,
      });
    } else {
      setStatus({
        isConfigured: false,
        isReady: false,
        hasToken: false,
        hasPhoneNumber: false,
        hasAgent: false,
        error: "Configuration Twilio non disponible",
        loading: false,
      });
    }
  }, [twilioConfig, isLoading, isError, error]);

  return status;
}

/**
 * Hook simplifié pour vérifier si Twilio est prêt
 * @returns boolean
 */
export function useTwilioReady(): boolean {
  const status = useTwilioStatus();
  return status.isReady;
}
