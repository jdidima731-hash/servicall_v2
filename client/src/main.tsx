import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import * as Sentry from "@sentry/react";
import App from "./App";

// ✅ Bloc 9: Initialisation Sentry Frontend
if ((import.meta as any).env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: (import.meta as any).env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: (import.meta as any).env.MODE,
  });
}
import { LOGIN_PATH } from "./const";
import { CsrfProvider } from "@/components/CsrfProvider";
import { I18nextProvider } from "react-i18next";
import i18n from "./lib/i18n";
import { getCsrfToken } from "@/hooks/useCsrfToken";
import "./index.css";
import "./lib/i18n"; // Activation du système de traduction global

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = LOGIN_PATH;
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
    // ✅ Bloc 9: Capture Sentry pour les erreurs de requête API
    Sentry.captureException(error, { tags: { type: "api_query" } });
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
    // ✅ Bloc 9: Capture Sentry pour les erreurs de mutation API
    Sentry.captureException(error, { tags: { type: "api_mutation" } });
  }
});

/**
 * ✅ CORRECTION CRITIQUE BUG CSRF POST-LOGIN
 * Factory pour créer un client tRPC avec le token CSRF courant.
 * Doit être appelée après chaque rafraîchissement du token CSRF (post-login)
 * pour que le nouveau token soit injecté dans les headers.
 */
export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        // ✅ BLOC 1: Gestion centralisée du CSRF - injection automatique du token
        // La fonction headers() est appelée à chaque requête, donc elle lit toujours
        // le token le plus récent depuis le store global (window.__CSRF_TOKEN__)
        headers() {
          const csrfToken = getCsrfToken();
          if (csrfToken) {
            return {
              'x-csrf-token': csrfToken,
            };
          }
          return {};
        },
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    ],
  });
}

// Instance initiale du client tRPC
const trpcClient = createTrpcClient();

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <CsrfProvider>
          <App />
        </CsrfProvider>
      </I18nextProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
