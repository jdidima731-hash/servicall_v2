import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CsrfProvider } from "./components/CsrfProvider";
import { TenantProvider } from "./contexts/TenantContext";
import "./lib/i18n";
import "./index.css";
import DashboardLayout from "./components/DashboardLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { RBACGuard } from "./components/RBACGuard";
import { LoadingState } from "./components/LoadingState";
import { ForbiddenState } from "./components/ErrorState";
import LoadingFallback from "./components/LoadingFallback";
import { lazyWithRetry } from "./components/LazyLoad";

// ============================================================================
// LAZY LOADING OPTIMISÉ AVEC RETRY AUTOMATIQUE
// ============================================================================

// Pages publiques (priorité haute - chargées rapidement)
const Home = lazyWithRetry(() => import("./pages/Home"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const Signup = lazyWithRetry(() => import("./pages/Signup"));
const Connected = lazyWithRetry(() => import("./pages/Connected"));
const SelectTenant = lazyWithRetry(() => import("./pages/SelectTenant"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

// Pages publiques spéciales (factures, paiements)
const InvoiceAcceptancePage = lazyWithRetry(() =>
  import("./pages/InvoiceAcceptancePage").then(m => ({ default: m.InvoiceAcceptancePage }))
);
const InvoicePaymentPage = lazyWithRetry(() =>
  import("./pages/InvoicePaymentPage").then(m => ({ default: m.InvoicePaymentPage }))
);

// Pages principales dashboard (priorité moyenne)
const AgentDashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Calls = lazyWithRetry(() => import("./pages/Calls"));
const Softphone = lazyWithRetry(() => import("./pages/Softphone"));
const Prospects = lazyWithRetry(() => import("./pages/Prospects"));
const Messages = lazyWithRetry(() => import("./pages/Messages"));
const ProspectDetail = lazyWithRetry(() => import("./pages/ProspectDetail"));
const ProspectDetail360 = lazyWithRetry(() => import("./pages/ProspectDetail360"));
const Tasks = lazyWithRetry(() => import("./pages/Tasks"));
const Leads = lazyWithRetry(() => import("./pages/Leads"));
const Clients = lazyWithRetry(() => import("./pages/Clients"));

// Pages secondaires (priorité basse - chargées à la demande)
const Campaigns = lazyWithRetry(() => import("./pages/Campaigns"));
const CampaignWizard = lazyWithRetry(() => import("./pages/CampaignWizard"));
const CalendarView = lazyWithRetry(() =>
  import("./pages/CalendarView").then(module => ({ default: module.CalendarView }))
);
const WorkflowsAdmin = lazyWithRetry(() => import("./pages/WorkflowsAdmin"));
const WorkflowEditor = lazyWithRetry(() =>
  import("./pages/WorkflowEditor").then(m => ({ default: m.WorkflowEditor }))
);
const Workflows = lazyWithRetry(() => import("./pages/Workflows"));
const WorkflowsAndAgentSwitch = lazyWithRetry(() => import("./pages/WorkflowsAndAgentSwitch"));
const InvoiceCreation = lazyWithRetry(() => import("./pages/InvoiceCreation"));
const InvoiceHistory = lazyWithRetry(() => import("./pages/InvoiceHistory"));
const Billing = lazyWithRetry(() => import("./pages/Billing"));
const BillingAdmin = lazyWithRetry(() => import("./pages/BillingAdmin"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Coaching = lazyWithRetry(() => import("./pages/Coaching"));
const Compliance = lazyWithRetry(() => import("./pages/Compliance"));
const ComplianceRGPD = lazyWithRetry(() => import("./pages/ComplianceRGPD"));
const AgentSwitch = lazyWithRetry(() => import("./pages/AgentSwitch"));
const RecruitmentInterviews = lazyWithRetry(() => import("./pages/RecruitmentInterviews"));
const RecruitmentEnhanced = lazyWithRetry(() => import("./pages/RecruitmentEnhanced"));
// Servicall v3 — Intelligence Centrale
const IntelligenceCentrale = lazyWithRetry(() => import("./pages/IntelligenceCentrale"));
const SocialMediaManager = lazyWithRetry(() => import("./pages/SocialMediaManager"));
const Documents = lazyWithRetry(() => import("./pages/Documents"));
const RecordingPlayer = lazyWithRetry(() =>
  import("./pages/RecordingPlayer").then(m => ({ default: m.RecordingPlayer }))
);
const AIRoleEditor = lazyWithRetry(() => import("./pages/AIRoleEditor"));
const AdminDashboard = lazyWithRetry(() =>
  import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard }))
);
const ManagerDashboard = lazyWithRetry(() =>
  import("./pages/ManagerDashboard").then(m => ({ default: m.ManagerDashboard }))
);

// Dashboards spécialisés (lourds - lazy loadés avec chunks séparés)
const IAMonitoringDashboard = lazyWithRetry(() =>
  import("./components/IAMonitoringDashboard").then(module => ({
    default: module.IAMonitoringDashboard
  }))
);
const BusinessIntelligenceDashboard = lazyWithRetry(() =>
  import("./components/BusinessIntelligenceDashboard").then(module => ({
    default: module.BusinessIntelligenceDashboard
  }))
);
const ObservabilityDashboard = lazyWithRetry(() =>
  import("./components/ObservabilityDashboard").then(module => ({
    default: module.ObservabilityDashboard
  }))
);
const ROIDashboard = lazyWithRetry(() => import("./components/ROIDashboard"));

// ✅ CORRECTION: Pages /admin et /subscription (routes manquantes — 404 corrigé)
const AdminPage = lazyWithRetry(() => import("./pages/admin"));
const SubscriptionPage = lazyWithRetry(() => import("./pages/subscription"));

// ============================================================================
// ROUTER AVEC SUSPENSE OPTIMISÉ
// ============================================================================

function Router() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingState fullScreen message="Authentification en cours..." />;
  }

  return (
    <Suspense fallback={<LoadingFallback message="Initialisation de l'application..." />}>
      <Switch>
        {/* Routes publiques */}
        <Route path={"/"} component={Home} />
        <Route path={"/contact"} component={Contact} />
        <Route path={"/login"} component={Login} />
        <Route path={"/signup"} component={Signup} />
        <Route path={"/connected"} component={Connected} />
        <Route path={"/select-tenant"} component={SelectTenant} />
        <Route path={"/privacy"} component={Privacy} />
        <Route path={"/terms"} component={Terms} />

        {/* Routes publiques spéciales - factures et paiements (sans DashboardLayout) */}
        <Route path={"/invoice/accept/:token"}>
          {() => (
            <Suspense fallback={<LoadingFallback message="Chargement de la facture..." />}>
              <InvoiceAcceptancePage />
            </Suspense>
          )}
        </Route>
        <Route path={"/invoice/payment/:token"}>
          {() => (
            <Suspense fallback={<LoadingFallback message="Chargement du paiement..." />}>
              <InvoicePaymentPage />
            </Suspense>
          )}
        </Route>

        {/* Dashboard Routes - Protected with RBAC */}
        <Route path={"/dashboard"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement du tableau de bord..." />}>
                  <AgentDashboard />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/social-manager"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="manager">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement du Social Media Manager..." />}>
                  <SocialMediaManager />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        {/* Dashboards admin/manager */}
        <Route path={"/admin"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement du tableau de bord admin..." />}>
                  <AdminDashboard />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/manager-dashboard"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement du tableau de bord manager..." />}>
                  <ManagerDashboard />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        {/* Dashboards spécialisés avec Suspense dédié */}
        <Route path={"/ia-monitoring"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement du monitoring IA..." />}>
                  <IAMonitoringDashboard />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/bi-insights"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement de la Business Intelligence..." />}>
                  <BusinessIntelligenceDashboard />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/observability"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement de l'observabilité..." />}>
                  <ObservabilityDashboard />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/roi-dashboard"}>
          {() => {
            const searchParams = new URLSearchParams(window.location.search);
            const tenantId = parseInt(searchParams.get("tenantId") || "0", 10);
            return (
              <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
                <DashboardLayout>
                  <Suspense fallback={<LoadingFallback message="Chargement du ROI..." />}>
                    <ROIDashboard tenantId={tenantId} />
                  </Suspense>
                </DashboardLayout>
              </RBACGuard>
            );
          }}
        </Route>

        {/* Routes principales */}
        <Route path={"/calls"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Calls />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/softphone"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Softphone />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/prospects"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Prospects />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/prospect/:id/360"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <ProspectDetail360 />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/prospect/:id"}>
          {(params) => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <ProspectDetail params={params} />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/leads"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Leads />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/clients"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Clients />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/campaigns"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <Campaigns />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/campaign-wizard"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <CampaignWizard />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/messages"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Messages />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/appointments"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <CalendarView />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/calendar"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <CalendarView />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/tasks"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Tasks />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/workflows"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <WorkflowsAdmin />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/workflows-list"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <Workflows />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/workflow-editor/:id"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <WorkflowEditor />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/workflow-editor"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <WorkflowEditor />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/workflows-agent-switch"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <WorkflowsAndAgentSwitch />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/invoices/history"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <InvoiceHistory />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/invoices"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <InvoiceCreation />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/billing"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <Billing />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/billing-admin"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <BillingAdmin />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/settings"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/coaching"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <Coaching />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/compliance"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <Compliance />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/compliance-rgpd"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <ComplianceRGPD />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/recruitment"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement du module recrutement..." />}>
                  <RecruitmentInterviews />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/recruitment-enhanced"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement du module recrutement IA..." />}>
                  <RecruitmentEnhanced />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/intelligence-centrale"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="manager">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement de l'Intelligence Centrale Servicall v3..." />}>
                  <IntelligenceCentrale />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/documents"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="agent">
              <Documents />
            </RBACGuard>
          )}
        </Route>

        <Route path={"/recordings/:id"}>
          {() => (
            <RBACGuard redirectTo="/login" requiredRole="agent">
              <DashboardLayout>
                <RecordingPlayer />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/agent-switch"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <AgentSwitch />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/ai-role-editor"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <AIRoleEditor />
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        {/* ✅ CORRECTION: Route /subscription créée (était 404) */}
        <Route path={"/subscription"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement de la gestion d'abonnement..." />}>
                  <SubscriptionPage />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        {/* ✅ CORRECTION: Route /admin/dashboard alias vers AdminDashboard */}
        <Route path={"/admin/dashboard"}>
          {() => (
            <RBACGuard fallback={<ForbiddenState />} requiredRole="admin">
              <DashboardLayout>
                <Suspense fallback={<LoadingFallback message="Chargement du tableau de bord admin..." />}>
                  <AdminPage />
                </Suspense>
              </DashboardLayout>
            </RBACGuard>
          )}
        </Route>

        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// ============================================================================
// APP COMPONENT
// ============================================================================

function App() {
  return (
    <ErrorBoundary>
      <CsrfProvider>
        <ThemeProvider defaultTheme="light">
          <TenantProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </TenantProvider>
        </ThemeProvider>
      </CsrfProvider>
    </ErrorBoundary>
  );
}

export default App;
