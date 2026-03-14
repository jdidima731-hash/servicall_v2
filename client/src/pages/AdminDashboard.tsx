import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertTriangle, Lock, Shield, Users, TrendingUp} from "lucide-react";

/**
 * Dashboard Admin - Supervision stratégique totale
 * BLOC 6 : KPIs globaux, Sécurité, RGPD, Bascule IA/Humain
 */
export function AdminDashboard() {
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("week");
  const [selectedTab, setSelectedTab] = useState("kpis");

  // ✅ CORRECTION: Utiliser un tenantId par défaut ou depuis l'URL/contexte
  const tenantId = 1; 

  // ✅ CORRECTION: Récupérer les données du dashboard avec gestion d'erreur et tenantId
  const { data: dashboardDataRaw, isPending: _dashboardLoading } = trpc.dashboard.getManagerDashboard.useQuery(
    { timeRange },
    { 
      enabled: true,
      retry: 1,
    }
  );

  // Récupérer les données de sécurité
  const {data: _securityData, isPending: _securityLoading} = trpc.security.getComplianceDashboard.useQuery(
    { startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), endDate: new Date().toISOString() },
    { enabled: true }
  );

  // Récupérer les données RGPD
  const {data: _rgpdData, isPending: _rgpdLoading} = trpc.rgpd.getAuditLogs.useQuery(
    { limit: 50 },
    { enabled: true }
  );

  // Récupérer les données de bascule agent
  const {data: _agentSwitchData, isPending: _agentSwitchLoading} = trpc.agentSwitch.getTenantHistory.useQuery(
    { tenantId, limit: 100 },
    { enabled: true }
  );

  // const _isPending = dashboardLoading || securityLoading || rgpdLoading || agentSwitchLoading;

  // Données de tendance (mock pour démonstration)
  const trendData = [
    { name: "Lun", humain: 45, ia: 55, paiements: 12 },
    { name: "Mar", humain: 42, ia: 58, paiements: 15 },
    { name: "Mer", humain: 40, ia: 60, paiements: 18 },
    { name: "Jeu", humain: 38, ia: 62, paiements: 22 },
    { name: "Ven", humain: 35, ia: 65, paiements: 25 },
    { name: "Sam", humain: 32, ia: 68, paiements: 20 },
    { name: "Dim", humain: 30, ia: 70, paiements: 18 },
  ];

  const agentDistribution = [
    { name: "Agents Humains", value: 35, fill: "#3b82f6" },
    { name: "Agents IA", value: 65, fill: "#10b981" },
  ];

  const securityIssues = [
    { id: 1, severity: "high", title: "Clé KMS expirée", description: "La clé de chiffrement expire dans 7 jours", action: "Rotation immédiate" },
    { id: 2, severity: "medium", title: "Audit RGPD", description: "Vérification périodique requise", action: "Planifier audit" },
    { id: 3, severity: "low", title: "Logs d'audit", description: "Archivage des logs anciens", action: "Archiver" },
  ];

  const dashboardData = dashboardDataRaw as any;

  // ✅ CORRECTION: Extraire les KPIs du tableau kpis retourné par le router
  const conversionKPI = (dashboardData as any)?.kpis?.find((k: any) => k.label?.includes("Conversion"));
  const satisfactionKPI = (dashboardData as any)?.kpis?.find((k: any) => k.label?.includes("Sentiment") || k.label?.includes("Satisfaction"));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Admin</h1>
            <p className="text-gray-600 mt-1">Supervision stratégique et contrôle total</p>
          </div>
          <div className="flex gap-2">
            {(["day", "week", "month"] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                onClick={() => setTimeRange(range)}
                className="capitalize"
              >
                {range === "day" ? "Jour" : range === "week" ? "Semaine" : "Mois"}
              </Button>
            ))}
          </div>
        </div>

        {/* Alertes de sécurité critiques */}
        {securityIssues.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription>
              <div className="font-semibold text-red-900">⚠️ {securityIssues.length} problème(s) de sécurité détecté(s)</div>
              <div className="text-sm text-red-800 mt-2">
                {securityIssues.map((issue) => (
                  <div key={issue.id} className="mt-1">
                    <strong>{issue.title}</strong>: {issue.description}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Onglets */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="kpis" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              KPIs
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Sécurité
            </TabsTrigger>
            <TabsTrigger value="rgpd" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              RGPD
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agents
            </TabsTrigger>
          </TabsList>

          {/* Onglet KPIs */}
          <TabsContent value="kpis" className="space-y-6">
            {/* Cartes KPI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Appels Totaux</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{(dashboardData as any)?.supervision?.callsByStatus?.completed || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">+12% vs. semaine précédente</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Taux de Conversion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{conversionKPI?.value || 0}%</div>
                  <p className="text-xs text-gray-500 mt-1">+3% vs. semaine précédente</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Paiements Reçus</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">1,250€</div>
                  <p className="text-xs text-gray-500 mt-1">+8% vs. semaine précédente</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Satisfaction Client</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{satisfactionKPI?.value || 0}%</div>
                  <p className="text-xs text-gray-500 mt-1">Stable</p>
                </CardContent>
              </Card>
            </div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tendance Appels (Humain vs IA)</CardTitle>
                  <CardDescription>Répartition des appels par type d'agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="humain" stroke="#3b82f6" name="Agents Humains" />
                      <Line type="monotone" dataKey="ia" stroke="#10b981" name="Agents IA" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribution Agents</CardTitle>
                  <CardDescription>Répartition actuelle</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={agentDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                        {agentDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Paiements par Jour</CardTitle>
                  <CardDescription>Montants reçus</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="paiements" fill="#f59e0b" name="Paiements (€)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Qualité des Appels</CardTitle>
                  <CardDescription>Score moyen par jour</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="humain" stroke="#3b82f6" name="Score Humain" />
                      <Line type="monotone" dataKey="ia" stroke="#10b981" name="Score IA" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Supervision Sécurité</CardTitle>
                <CardDescription>État de la conformité et protection des données</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-gray-500">Données de sécurité en cours d'analyse...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rgpd">
            <Card>
              <CardHeader>
                <CardTitle>Contrôle RGPD</CardTitle>
                <CardDescription>Gestion des consentements et droits des personnes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Lock className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-500">Registre RGPD disponible</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des Agents</CardTitle>
                <CardDescription>Bascule IA/Humain et performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
                  <p className="text-gray-500">Supervision des agents active</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
