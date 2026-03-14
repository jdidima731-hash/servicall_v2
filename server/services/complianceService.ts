/**
 * Compliance Service - Vérification de conformité et génération de rapports
 * Assure conformité GDPR, CCPA et autres réglementations
 */

import { db } from '@db';
import { complianceLogs, complianceAlerts, calls, recordings } from '@db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { logger as loggingService } from "../infrastructure/logger";
import { AuditService } from './auditService';
import { alertService } from './alertService';

interface ComplianceCheck {
  id: string;
  tenantId: number;
  checkType: 'gdpr' | 'ccpa' | 'hipaa' | 'pci' | 'sox' | 'custom';
  status: 'compliant' | 'warning' | 'violation';
  resource: string;
  resourceId: string;
  details: Record<string, any>;
  checkedAt: Date;
}

interface ComplianceViolation {
  id: string;
  tenantId: number;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resource: string;
  resourceId: string;
  description: string;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

interface ComplianceDashboard {
  tenantId: number;
  period: { start: Date; end: Date };
  summary: {
    totalChecks: number;
    compliant: number;
    warnings: number;
    violations: number;
    complianceRate: number;
  };
  violations: ComplianceViolation[];
  recommendations: string[];
  nextAuditDate: Date;
}

export class ComplianceService {
  private readonly RETENTION_PERIODS = {
    gdpr: 30, // jours
    ccpa: 365,
    hipaa: 2555, // 7 ans
    default: 365
  };

  /**
   * Vérifie la conformité d'un appel
   */
  async checkCallCompliance(
    callId: number,
    tenantId: number
  ): Promise<ComplianceCheck> {
    try {
      const call = await db.query.calls.findFirst({
        where: and(eq(calls.id, callId), eq(calls.tenantId, tenantId))
      });

      if (!call) {
        throw new Error('Appel non trouvé');
      }

      const violations: string[] = [];
      const warnings: string[] = [];

      // Vérification GDPR - Consentement
      if (!call.consentGiven) {
        violations.push('Absence de consentement GDPR pour l\'enregistrement');
      }

      // Vérification - Durée de rétention
      const retentionDays = this.RETENTION_PERIODS.gdpr;
      const callAge = (Date.now() - call.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (callAge > retentionDays && call.status !== 'archived') {
        warnings.push(`Appel dépasse la période de rétention (${retentionDays} jours)`);
      }

      // Vérification - Chiffrement
      if (!call.encrypted) {
        violations.push('Données non chiffrées');
      }

      // Vérification - Anonymisation si requis
      if (call.requiresAnonymization && !call.anonymized) {
        violations.push('Anonymisation requise mais non effectuée');
      }

      // Vérification - Accès non autorisé
      const auditLogs = await AuditService.getLogsForResource(
        tenantId,
        'call',
        callId.toString()
      );

      const unauthorizedAccess = auditLogs.filter(
        (log: unknown) => log.action === 'ACCESS_DENIED' || log.action === 'UNAUTHORIZED_ACCESS'
      );

      if (unauthorizedAccess.length > 0) {
        violations.push(`${unauthorizedAccess.length} tentative(s) d'accès non autorisé détectée(s)`);
      }

      const status: 'compliant' | 'warning' | 'violation' =
        violations.length > 0 ? 'violation' : warnings.length > 0 ? 'warning' : 'compliant';

      const check: ComplianceCheck = {
        id: crypto.randomUUID(),
        tenantId,
        checkType: 'gdpr',
        status,
        resource: 'call',
        resourceId: callId.toString(),
        details: {
          violations,
          warnings,
          callAge: Math.floor(callAge),
          consentGiven: call.consentGiven,
          encrypted: call.encrypted
        },
        checkedAt: new Date()
      };

      // Sauvegarder le résultat
      await db.insert(complianceLogs).values(check);

      // Créer une alerte si violation
      if (violations.length > 0) {
        await this.createComplianceAlert(tenantId, check, violations);
      }

      loggingService.info('Compliance: Vérification effectuée', {
        tenantId,
        callId,
        violationsCount: violations.length
      });

      return check;
    } catch (error: unknown) {
      loggingService.error('Compliance: Erreur lors de la vérification', {
        error,
        tenantId,
        callId
      });
      throw new Error('Impossible de vérifier la conformité de l\'appel');
    }
  }

  /**
   * Vérifie la conformité du stockage des données
   */
  async checkStorageCompliance(tenantId: number): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    try {
      // Vérifier les enregistrements
      const allRecordings = await db.query.recordings.findMany({
        where: eq(recordings.tenantId, tenantId)
      });

      for (const recording of allRecordings) {
        const violations: string[] = [];
        const warnings: string[] = [];

        // Vérifier chiffrement
        if (!recording.encrypted) {
          violations.push('Enregistrement non chiffré');
        }

        // Vérifier période de rétention
        const age = (Date.now() - recording.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (age > this.RETENTION_PERIODS.gdpr) {
          warnings.push('Enregistrement dépasse la période de rétention');
        }

        const status: 'compliant' | 'warning' | 'violation' =
          violations.length > 0 ? 'violation' : warnings.length > 0 ? 'warning' : 'compliant';

        const check: ComplianceCheck = {
          id: crypto.randomUUID(),
          tenantId,
          checkType: 'gdpr',
          status,
          resource: 'recording',
          resourceId: recording.id.toString(),
          details: { violations, warnings, age: Math.floor(age) },
          checkedAt: new Date()
        };

        checks.push(check);

        if (violations.length > 0) {
          await this.createComplianceAlert(tenantId, check, violations);
        }
      }

      // Sauvegarder tous les checks
      if (checks.length > 0) {
        await db.insert(complianceLogs).values(checks);
      }

      loggingService.info('Compliance: Vérification du stockage effectuée', {
        tenantId,
        totalChecks: checks.length,
        violations: checks.filter(c => c.status === 'violation').length
      });

      return checks;
    } catch (error: unknown) {
      loggingService.error('Compliance: Erreur lors de la vérification du stockage', {
        error,
        tenantId
      });
      throw new Error('Impossible de vérifier la conformité du stockage');
    }
  }

  /**
   * Vérifie la conformité des flux IA
   */
  async checkAIWorkflowCompliance(
    tenantId: number,
    workflowId: string
  ): Promise<ComplianceCheck> {
    try {
      const violations: string[] = [];
      const warnings: string[] = [];

      // Vérifier que les transferts IA ↔ Humain sont sécurisés
      const auditLogs = await AuditService.getLogsForResource(
        tenantId,
        'ai_workflow',
        workflowId
      );

      const transfers = auditLogs.filter((log: unknown) => log.action === 'AI_HUMAN_TRANSFER');

      for (const transfer of transfers) {
        if (!transfer.details?.encrypted) {
          violations.push('Transfert IA ↔ Humain non chiffré détecté');
        }

        if (!transfer.details?.contextValidated) {
          warnings.push('Contexte de transfert non validé');
        }
      }

      // Vérifier la traçabilité
      const aiActions = auditLogs.filter((log: unknown) => log.action.startsWith('AI_'));
      if (aiActions.length === 0) {
        warnings.push('Aucune trace d\'actions IA trouvée');
      }

      const status: 'compliant' | 'warning' | 'violation' =
        violations.length > 0 ? 'violation' : warnings.length > 0 ? 'warning' : 'compliant';

      const check: ComplianceCheck = {
        id: crypto.randomUUID(),
        tenantId,
        checkType: 'custom',
        status,
        resource: 'ai_workflow',
        resourceId: workflowId,
        details: {
          violations,
          warnings,
          totalTransfers: transfers.length,
          totalAIActions: aiActions.length
        },
        checkedAt: new Date()
      };

      await db.insert(complianceLogs).values(check);

      if (violations.length > 0) {
        await this.createComplianceAlert(tenantId, check, violations);
      }

      return check;
    } catch (error: unknown) {
      loggingService.error('Compliance: Erreur lors de la vérification des flux IA', {
        error,
        tenantId,
        workflowId
      });
      throw new Error('Impossible de vérifier la conformité des flux IA');
    }
  }

  /**
   * Génère un tableau de bord de conformité
   */
  async generateComplianceDashboard(
    tenantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceDashboard> {
    try {
      // Récupérer tous les checks de la période
      const checks = await db.query.complianceLogs.findMany({
        where: and(
          eq(complianceLogs.tenantId, tenantId),
          gte(complianceLogs.checkedAt, startDate),
          lte(complianceLogs.checkedAt, endDate)
        ),
        orderBy: [desc(complianceLogs.checkedAt)]
      });

      const totalChecks = checks.length;
      const compliant = checks.filter((c: unknown) => c.status === 'compliant').length;
      const warnings = checks.filter((c: unknown) => c.status === 'warning').length;
      const violations = checks.filter((c: unknown) => c.status === 'violation').length;
      const complianceRate = totalChecks > 0 ? (compliant / totalChecks) * 100 : 100;

      // Récupérer les violations non résolues
      const activeViolations = await db.query.complianceAlerts.findMany({
        where: and(
          eq(complianceAlerts.tenantId, tenantId),
          eq(complianceAlerts.resolved, false)
        ),
        orderBy: [desc(complianceAlerts.detectedAt)],
        limit: 10
      });

      // Générer des recommandations
      const recommendations: string[] = [];

      if (complianceRate < 95) {
        recommendations.push('Taux de conformité inférieur à 95% - Audit approfondi recommandé');
      }

      if (violations > 0) {
        recommendations.push(`${violations} violation(s) détectée(s) - Action immédiate requise`);
      }

      if (warnings > totalChecks * 0.1) {
        recommendations.push('Nombre élevé d\'avertissements - Révision des processus recommandée');
      }

      // Calculer la date du prochain audit
      const nextAuditDate = new Date();
      nextAuditDate.setDate(nextAuditDate.getDate() + 30);

      const dashboard: ComplianceDashboard = {
        tenantId,
        period: { start: startDate, end: endDate },
        summary: {
          totalChecks,
          compliant,
          warnings,
          violations,
          complianceRate: Math.round(complianceRate * 100) / 100
        },
        violations: activeViolations as unknown,
        recommendations,
        nextAuditDate
      };

      loggingService.info('Compliance: Dashboard généré', {
        tenantId,
        complianceRate,
        totalChecks
      });

      return dashboard;
    } catch (error: unknown) {
      loggingService.error('Compliance: Erreur lors de la génération du dashboard', {
        error,
        tenantId
      });
      throw new Error('Impossible de générer le tableau de bord de conformité');
    }
  }

  /**
   * Génère un rapport d'audit pour export
   */
  async generateAuditReport(
    tenantId: number,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<string> {
    try {
      const dashboard = await this.generateComplianceDashboard(tenantId, startDate, endDate);

      // Récupérer les logs d'audit détaillés
      const auditLogs = await AuditService.getLogsForPeriod(tenantId, startDate, endDate);

      const report = {
        generatedAt: new Date(),
        tenantId,
        period: { start: startDate, end: endDate },
        dashboard,
        auditLogs: auditLogs.slice(0, 100), // Limiter pour la taille
        metadata: {
          totalAuditLogs: auditLogs.length,
          reportFormat: format
        }
      };

      if (format === 'json') {
        return JSON.stringify(report, null, 2);
      }

      // TODO: Implémenter CSV et PDF
      return JSON.stringify(report, null, 2);
    } catch (error: unknown) {
      loggingService.error('Compliance: Erreur lors de la génération du rapport', {
        error,
        tenantId
      });
      throw new Error('Impossible de générer le rapport d\'audit');
    }
  }

  /**
   * Crée une alerte de conformité
   */
  private async createComplianceAlert(
    tenantId: number,
    check: ComplianceCheck,
    violations: string[]
  ): Promise<void> {
    try {
      const alert = {
        id: crypto.randomUUID(),
        tenantId,
        violationType: check.checkType,
        severity: violations.length > 2 ? 'critical' : violations.length > 1 ? 'high' : 'medium',
        resource: check.resource,
        resourceId: check.resourceId,
        description: violations.join('; '),
        detectedAt: new Date(),
        resolved: false
      };

      await db.insert(complianceAlerts).values(alert as unknown);

      // Envoyer une alerte temps réel
      alertService.sendAlert(
        'Compliance Violation',
        (alert.severity as string) as 'low' | 'medium' | 'high' | 'critical',
        {
          tenantId,
          type: 'compliance_violation',
          title: 'Violation de conformité détectée',
          message: alert.description,
          module: 'compliance',
          metadata: { checkId: check.id, resource: check.resource }
        }
      );

      loggingService.warn('Compliance: Alerte créée', {
        tenantId,
        alertId: alert.id,
        severity: alert.severity
      });
    } catch (error: unknown) {
      loggingService.error('Compliance: Erreur lors de la création d\'alerte', {
        error,
        tenantId
      });
    }
  }

  /**
   * Résout une violation de conformité
   */
  async resolveViolation(
    tenantId: number,
    violationId: string,
    resolution: string,
    userId: number
  ): Promise<void> {
    try {
      await db
        .update(complianceAlerts)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ resolved: true, resolvedAt: new Date(), resolution } as unknown)
        .where(
          and(
            eq(complianceAlerts.id, Number(violationId)),
            eq(complianceAlerts.tenantId, tenantId)
          )
        );

      await AuditService.log({
        tenantId,
        action: 'RESOURCE_UPDATE' as import('./auditService').AuditAction,
        resource: 'compliance_alert',
        resourceId: violationId,
        metadata: { resolution },
        userId,
        actorType: 'human' as const,
        source: 'API' as const
      });

      loggingService.info('Compliance: Violation résolue', {
        tenantId,
        violationId,
        userId
      });
    } catch (error: unknown) {
      loggingService.error('Compliance: Erreur lors de la résolution de violation', {
        error,
        tenantId,
        violationId
      });
      throw new Error('Impossible de résoudre la violation');
    }
  }

  /**
   * Vérifie automatiquement la conformité de manière périodique
   */
  async runPeriodicComplianceCheck(tenantId: number): Promise<void> {
    try {
      loggingService.info('Compliance: Début de la vérification périodique', { tenantId });

      // Vérifier les appels
      const recentCalls = await db.query.calls.findMany({
        where: eq(calls.tenantId, tenantId),
        limit: 100,
        orderBy: [desc(calls.createdAt)]
      });

      for (const call of recentCalls) {
        await this.checkCallCompliance(call.id, tenantId);
      }

      // Vérifier le stockage
      await this.checkStorageCompliance(tenantId);

      loggingService.info('Compliance: Vérification périodique terminée', { tenantId });
    } catch (error: unknown) {
      loggingService.error('Compliance: Erreur lors de la vérification périodique', {
        error,
        tenantId
      });
    }
  }
}

export const complianceService = new ComplianceService();
