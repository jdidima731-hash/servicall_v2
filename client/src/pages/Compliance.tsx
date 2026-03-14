/**
 * Compliance Page - Dashboard de conformité et sécurité
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Key,
  Lock,
  FileText,
  RefreshCw,
  Download,
  Eye,
  TrendingUp,
} from 'lucide-react';

export default function Compliance() {
  const { t } = useTranslation();
  const [dateRange, _setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  });
  const [selectedViolation, setSelectedViolation] = useState<any>(null);
  const [resolution, setResolution] = useState('');

  // Queries
  const { data: dashboardData, refetch: refetchDashboard } =
    trpc.security.getComplianceDashboard.useQuery(dateRange);

  const { data: keyHealthData } = trpc.security.checkKeyHealth.useQuery();

  // Mutations
  const runComplianceCheck = trpc.security.runPeriodicComplianceCheck.useMutation({
    onSuccess: () => {
      setTimeout(() => refetchDashboard(), 2000);
    },
  });

  const resolveViolationMutation = trpc.security.resolveViolation.useMutation({
    onSuccess: () => {
      setSelectedViolation(null);
      setResolution('');
      refetchDashboard();
    },
  });

  const generateReport = trpc.security.generateAuditReport.useMutation();

  const rotateKey = trpc.security.rotateKey.useMutation();

  const dashboard = dashboardData?.dashboard;
  const keyHealth = keyHealthData;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  // const _getStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'compliant':
  //       return 'text-green-500';
  //     case 'warning':
  //       return 'text-yellow-500';
  //     case 'violation':
  //       return 'text-red-500';
  //     default:
  //       return 'text-gray-500';
  //   }
  // };

  const handleResolveViolation = () => {
    if (!selectedViolation || !resolution.trim()) return;

    resolveViolationMutation.mutate({
      violationId: selectedViolation.id,
      resolution,
    });
  };

  const handleGenerateReport = (format: 'json' | 'csv' | 'pdf') => {
    generateReport.mutate({
      ...dateRange,
      format,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('compliance.title')}</h1>
          <p className="text-muted-foreground">
            {t('compliance.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runComplianceCheck.mutate()}
            disabled={runComplianceCheck.isPending}
            variant="outline"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${runComplianceCheck.isPending ? 'animate-spin' : ''}`}
            />
            Vérifier
          </Button>
          <Button onClick={() => handleGenerateReport('json')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Rapport
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {dashboard && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('compliance.compliance_rate')}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(dashboard as any)?.complianceRate}%
              </div>
              <Progress value={(dashboard as any)?.complianceRate} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {(dashboard as any)?.compliantCount} / {(dashboard as any)?.totalChecks} conformes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('compliance.violations')}</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {(dashboard as any)?.violationsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Action immédiate requise
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('compliance.warnings')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {(dashboard as any)?.warningsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                À surveiller
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('compliance.next_audit')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {new Date((dashboard as any)?.nextAuditDate).toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Dans{' '}
                {Math.ceil(
                  (new Date((dashboard as any)?.nextAuditDate).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                )}{' '}
                jours
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="violations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="violations">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {t('compliance.violations')}
          </TabsTrigger>
          <TabsTrigger value="keys">
            <Key className="h-4 w-4 mr-2" />
            {t('compliance.keys')}
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <TrendingUp className="h-4 w-4 mr-2" />
            {t('compliance.recommendations')}
          </TabsTrigger>
        </TabsList>

        {/* Violations Tab */}
        <TabsContent value="violations">
          <Card>
            <CardHeader>
              <CardTitle>Violations de Conformité</CardTitle>
              <CardDescription>
                Violations actives nécessitant une résolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard && (dashboard as any)?.violations?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Sévérité</TableHead>
                      <TableHead>Ressource</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Détecté</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dashboard as any)?.violations?.map((violation: any) => (
                      <TableRow key={violation.id}>
                        <TableCell>
                          <Badge>{violation.violationType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(violation.severity)}>
                            {violation.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {violation.resource} #{violation.resourceId}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {violation.description}
                        </TableCell>
                        <TableCell>
                          {new Date(violation.detectedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedViolation(violation)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Résoudre
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Résoudre la Violation</DialogTitle>
                                <DialogDescription>
                                  Décrivez les actions prises pour résoudre cette
                                  violation
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-semibold">Description:</p>
                                  <p className="text-sm text-muted-foreground">
                                    {violation.description}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-semibold">
                                    Résolution:
                                  </label>
                                  <Textarea
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    placeholder="Décrivez les actions correctives..."
                                    rows={4}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={handleResolveViolation}
                                  disabled={resolveViolationMutation.isPending}
                                >
                                  Marquer comme Résolu
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Aucune violation active</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keys Tab */}
        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des Clés de Chiffrement</CardTitle>
              <CardDescription>
                État des clés et opérations de sécurité
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {keyHealth && (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {keyHealth.healthy ? (
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      ) : (
                        <XCircle className="h-8 w-8 text-red-500" />
                      )}
                      <div>
                        <p className="font-semibold">
                          État: {keyHealth.healthy ? 'Sain' : 'Problèmes Détectés'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Dernière vérification: {new Date().toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => rotateKey.mutate({ keyType: 'data' })}
                      disabled={rotateKey.isPending}
                      variant="outline"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Rotation de Clé
                    </Button>
                  </div>

                  {(keyHealth as any).warnings && (keyHealth as any).warnings.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-semibold text-yellow-600">Avertissements:</p>
                      <ul className="space-y-1">
                        {((keyHealth as any).warnings as string[]).map((warning: string, idx: number) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(keyHealth as any).errors && (keyHealth as any).errors.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-semibold text-red-600">Erreurs:</p>
                      <ul className="space-y-1">
                        {((keyHealth as any).errors as string[]).map((error: string, idx: number) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <XCircle className="h-4 w-4 text-red-500" />
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <div className="grid gap-4 md:grid-cols-3 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Clés Master</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span className="text-sm">Actives et sécurisées</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Clés de Données</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      <span className="text-sm">Rotation automatique</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Clés de Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm">Éphémères</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Recommandations</CardTitle>
              <CardDescription>
                Actions suggérées pour améliorer la conformité
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard && (dashboard as any).recommendations && (dashboard as any).recommendations.length > 0 ? (
                <ul className="space-y-3">
                  {((dashboard as any).recommendations as string[]).map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                      <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Aucune recommandation - Tout est conforme !</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
