import OpenAI from 'openai';
import { AI_MODEL } from '../_core/aiModels';
import { db } from "../db";
import { 
  candidateInterviews, 
  interviewQuestions, 
  recruitmentSettings,
  type CandidateInterview 
} from "../../drizzle/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { getOpenAIClient } from "../_core/openaiClient";
import { encryptionService } from "./encryptionService";
import { logger as mainLogger } from "../infrastructure/logger";
import { sendEmail } from "./notificationService";

const logger = mainLogger.child({ service: "RecruitmentService" });

interface InterviewQuestion {
  question: string;
  category: string;
  expectedKeywords?: string[];
  weight: number;
}

interface InterviewAnalysis {
  globalScore: number;
  criteriaScores: {
    [key: string]: {
      score: number;
      comment: string;
      weight: number;
    };
  };
  behavioralAnalysis: {
    emotions: string[];
    emotionTimeline: {
      timestamp: number;
      emotion: string;
      intensity: number;
    }[];
    coherenceScore: number;
    honestyScore: number;
    communicationScore: number;
  };
  redFlags: string[];
  strengths: string[];
}

interface InterviewRecommendation {
  recommendation: "hire" | "maybe" | "reject";
  confidence: number;
  summary: string;
}

export class RecruitmentService {
  private openai: OpenAI;

  constructor() {
    // ✅ CORRIGÉ: Initialisation OpenAI avec l'API officielle (plus de proxy forge.manus.im)
    this.openai = getOpenAIClient();
  }

  /**
   * Créer un nouvel entretien candidat
   */
  async createInterview(data: {
    tenantId: number;
    candidateName: string;
    candidateEmail?: string;
    candidatePhone: string;
    businessType: string;
    jobPosition: string;
    scheduledAt?: Date;
    source?: string;
    metadata?: unknown;
  }): Promise<CandidateInterview> {
    try {
      logger.info({ tenantId: data.tenantId, businessType: data.businessType }, "Creating new candidate interview");

      // Chiffrer les données sensibles
      const encryptOpts = { tenantId: data.tenantId, dataType: 'personal' as const };
      const encryptedName = await encryptionService.encrypt(data.candidateName, encryptOpts);
      const encryptedEmail = data.candidateEmail 
        ? await encryptionService.encrypt(data.candidateEmail, encryptOpts) 
        : null;
      const encryptedPhone = await encryptionService.encrypt(data.candidatePhone, encryptOpts);

      // Calculer la date de rétention des données
      const settings = await this.getRecruitmentSettings(data.tenantId, data.businessType);
      const retentionDays = settings?.dataRetentionDays ?? 90;
      const dataRetentionUntil = new Date();
      dataRetentionUntil.setDate(dataRetentionUntil.getDate() + retentionDays);

      const [interview] = await db.insert(candidateInterviews).values({
        tenantId: data.tenantId,
        candidateName: encryptedName,
        candidateEmail: encryptedEmail,
        candidatePhone: encryptedPhone,
        businessType: data.businessType,
        jobPosition: data.jobPosition,
        scheduledAt: data.scheduledAt || new Date(),
        source: (data.source as unknown) || "platform",
        status: "pending",
        consentGiven: true, // À adapter selon votre flux de consentement
        dataRetentionUntil,
        metadata: data.metadata || {},
      }).returning();

      logger.info({ interviewId: interview.id }, "Interview created successfully");
      return interview;
    } catch (error: unknown) {
      logger.error({ error, tenantId: data.tenantId }, "Failed to create interview");
      throw error;
    }
  }

  /**
   * Démarrer un entretien IA automatiquement
   */
  async receiveCall(interviewId: number): Promise<void> {
    try {
      logger.info({ interviewId }, "Starting AI interview call");

      const interview = await db.query.candidateInterviews.findFirst({
        where: eq(candidateInterviews.id, interviewId),
      });

      if (!interview) {
        throw new Error(`Interview ${interviewId} not found`);
      }

      // Décrypter le téléphone
      const phone = await encryptionService.decrypt(interview.candidatePhone!, { tenantId: interview.tenantId, dataType: 'personal' as const });

      // Récupérer les questions métier
      const questions = await this.getInterviewQuestions(interview.tenantId, interview.businessType);

      // Récupérer la configuration
      const settings = await this.getRecruitmentSettings(interview.tenantId, interview.businessType);

      // Générer le script d'entretien
      const script = this.generateInterviewScript(interview, questions, settings);

      // Mettre à jour le statut
      await db.update(candidateInterviews)
        .set({ 
          status: "scheduled",
          updatedAt: new Date(),
        })
        .where(eq(candidateInterviews.id, interviewId));

      // Initier l'appel via Twilio (à adapter selon votre implémentation)
      const callSid = await this.initiateAICall(phone, script, interviewId);

      // Mettre à jour avec le call_sid
      await db.update(candidateInterviews)
        .set({ 
          callSid,
          status: "in_progress",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(candidateInterviews.id, interviewId));

      logger.info({ interviewId, callSid }, "AI interview call initiated");
    } catch (error: unknown) {
      logger.error({ error, interviewId }, "Failed to start AI interview");
      
      // Mettre à jour le statut en cas d'erreur
      await db.update(candidateInterviews)
        .set({ 
          status: "cancelled",
          metadata: { error: String(error) },
          updatedAt: new Date(),
        })
        .where(eq(candidateInterviews.id, interviewId));
      
      throw error;
    }
  }

  /**
   * Analyser les réponses du candidat
   */
  async analyzeResponses(interviewId: number, transcript: string): Promise<InterviewAnalysis> {
    try {
      logger.info({ interviewId }, "Analyzing interview responses");

      const interview = await db.query.candidateInterviews.findFirst({
        where: eq(candidateInterviews.id, interviewId),
      });

      if (!interview) {
        throw new Error(`Interview ${interviewId} not found`);
      }

      const questions = await this.getInterviewQuestions(interview.tenantId, interview.businessType);
      const settings = await this.getRecruitmentSettings(interview.tenantId, interview.businessType);

      // Analyse via GPT-4
      const analysis = await this.performAIAnalysis(transcript, questions, interview.businessType, settings);

      logger.info({ interviewId, globalScore: analysis.globalScore }, "Analysis completed");
      return analysis;
    } catch (error: unknown) {
      logger.error({ error, interviewId }, "Failed to analyze responses");
      throw error;
    }
  }

  /**
   * Effectuer l'analyse IA avec GPT-4
   */
  private async performAIAnalysis(
    transcript: string,
    questions: InterviewQuestion[],
    businessType: string,
    settings: unknown): Promise<InterviewAnalysis> {
    const systemPrompt = `Tu es un expert en recrutement spécialisé dans le secteur "${businessType}".
Ton rôle est d'analyser l'entretien d'un candidat et de fournir une évaluation détaillée.

Tu dois évaluer :
1. **Compétences techniques** : Adéquation avec le poste
2. **Communication** : Clarté, articulation, capacité d'expression
3. **Cohérence** : Logique des réponses, absence de contradictions
4. **Honnêteté** : Détection de mensonges potentiels, exagérations
5. **Émotions** : État émotionnel (confiant, nerveux, calme, stressé, etc.)
6. **Motivation** : Intérêt réel pour le poste

Pour chaque critère, attribue un score de 0 à 10.
Identifie également :
- Les **signaux d'alerte** (red flags)
- Les **points forts** du candidat
- Une **chronologie émotionnelle** avec timestamps

Réponds UNIQUEMENT en JSON valide selon ce format exact :
{
  "criteriaScores": {
    "technical": { "score": 7.5, "comment": "...", "weight": 1.5 },
    "communication": { "score": 8.0, "comment": "...", "weight": 1.2 },
    "coherence": { "score": 6.5, "comment": "...", "weight": 1.3 },
    "honesty": { "score": 7.0, "comment": "...", "weight": 1.4 },
    "motivation": { "score": 8.5, "comment": "...", "weight": 1.1 }
  },
  "behavioralAnalysis": {
    "emotions": ["confident", "calm"],
    "emotionTimeline": [
      { "timestamp": 30, "emotion": "nervous", "intensity": 0.6 },
      { "timestamp": 120, "emotion": "confident", "intensity": 0.8 }
    ],
    "coherenceScore": 7.5,
    "honestyScore": 8.0,
    "communicationScore": 8.5
  },
  "redFlags": ["Contradiction sur l'expérience précédente"],
  "strengths": ["Excellente communication", "Motivation claire"]
}`;

    const userPrompt = `Voici le transcript de l'entretien :

${transcript}

Questions posées :
${questions.map((q, i) => `${i + 1}. [${q.category}] ${q.question}`).join("\n")}

Analyse ce transcript et fournis ton évaluation en JSON.`;

    const response = await this.openai.chat.completions.create({
      model: settings?.aiModel || AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: parseFloat(settings?.aiTemperature || "0.7"),
      response_format: { type: "json_object" },
    });

    const analysisData = JSON.parse(response.choices[0]!.message.content || "{}");

    // Calculer le score global pondéré
    const criteriaScores = analysisData.criteriaScores || {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const [_key, value] of Object.entries(criteriaScores)) {
      const criteria = value as unknown;
      totalWeightedScore += criteria.score * criteria.weight;
      totalWeight += criteria.weight;
    }

    const globalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    return {
      globalScore: Math.round(globalScore * 10) / 10,
      criteriaScores,
      behavioralAnalysis: analysisData.behavioralAnalysis || {
        emotions: [],
        emotionTimeline: [],
        coherenceScore: 0,
        honestyScore: 0,
        communicationScore: 0,
      },
      redFlags: analysisData.redFlags || [],
      strengths: analysisData.strengths || [],
    };
  }

  /**
   * Générer le rapport final
   */
  async generateReport(interviewId: number): Promise<void> {
    try {
      logger.info({ interviewId }, "Generating interview report");

      const interview = await db.query.candidateInterviews.findFirst({
        where: eq(candidateInterviews.id, interviewId),
      });

      if (!interview || !interview.transcript) {
        throw new Error(`Interview ${interviewId} not found or no transcript available`);
      }

      // Analyser les réponses
      const analysis = await this.analyzeResponses(interviewId, interview.transcript);

      // Générer la recommandation
      const recommendation = await this.generateRecommendation(analysis, interview);

      // Mettre à jour l'entretien avec les résultats
      await db.update(candidateInterviews)
        .set({
          notesJson: analysis as unknown,
          aiSummary: recommendation.summary,
          aiRecommendation: recommendation.recommendation,
          aiConfidence: recommendation.confidence.toString(),
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(candidateInterviews.id, interviewId));

      // Notifier l'employeur
      await this.notifyEmployer(interview.tenantId, interviewId);

      logger.info({ interviewId, recommendation: recommendation.recommendation }, "Report generated successfully");
    } catch (error: unknown) {
      logger.error({ error, interviewId }, "Failed to generate report");
      throw error;
    }
  }

  /**
   * Générer une recommandation basée sur l'analyse
   */
  private async generateRecommendation(
    analysis: InterviewAnalysis,
    interview: CandidateInterview
  ): Promise<InterviewRecommendation> {
    const settings = await this.getRecruitmentSettings(interview.tenantId, interview.businessType);

    const minGlobalScore = parseFloat(settings?.minGlobalScore || "6.0");
    const minCoherenceScore = parseFloat(settings?.minCoherenceScore || "7.0");
    const minHonestyScore = parseFloat(settings?.minHonestyScore || "7.0");

    let recommendation: "hire" | "maybe" | "reject" = "maybe";
    let confidence = 50;

    // Logique de décision
    const hasRedFlags = analysis.redFlags.length > 0;
    const meetsGlobalScore = analysis.globalScore >= minGlobalScore;
    const meetsCoherence = analysis.behavioralAnalysis.coherenceScore >= minCoherenceScore;
    const meetsHonesty = analysis.behavioralAnalysis.honestyScore >= minHonestyScore;

    if (hasRedFlags || !meetsHonesty) {
      recommendation = "reject";
      confidence = 80;
    } else if (meetsGlobalScore && meetsCoherence && meetsHonesty) {
      recommendation = "hire";
      confidence = 85;
    } else if (meetsGlobalScore || meetsCoherence) {
      recommendation = "maybe";
      confidence = 60;
    } else {
      recommendation = "reject";
      confidence = 75;
    }

    // Générer le résumé
    const summary = await this.generateSummary(analysis, interview);

    return { recommendation, confidence, summary };
  }

  /**
   * Générer un résumé textuel de l'entretien
   */
  private async generateSummary(
    analysis: InterviewAnalysis,
    interview: CandidateInterview
  ): Promise<string> {
    const systemPrompt = `Tu es un recruteur professionnel. Génère un résumé concis et professionnel de l'entretien d'un candidat en 3-4 phrases maximum.`;

    const userPrompt = `Poste : ${interview.jobPosition}
Secteur : ${interview.businessType}

Score global : ${analysis.globalScore}/10
Score de cohérence : ${analysis.behavioralAnalysis.coherenceScore}/10
Score d'honnêteté : ${analysis.behavioralAnalysis.honestyScore}/10

Points forts : ${analysis.strengths.join(", ")}
Signaux d'alerte : ${analysis.redFlags.join(", ") || "Aucun"}

Génère un résumé professionnel.`;

    const response = await this.openai.chat.completions.create({
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0]!.message.content || "Résumé non disponible";
  }

  /**
   * Notifier l'employeur qu'un entretien est terminé
   */
  async notifyEmployer(tenantId: number, interviewId: number): Promise<void> {
    try {
      const settings = await this.getRecruitmentSettings(tenantId, "default");

      if (settings?.notifyOnCompletion && settings?.notificationEmail) {
        await sendEmail({
          to: settings.notificationEmail,
          subject: "Nouvel entretien candidat terminé",
          text: `Un nouvel entretien candidat (ID: ${interviewId}) a été complété et analysé. Consultez le dashboard pour voir les résultats.`,
        });

        logger.info({ tenantId, interviewId }, "Employer notified");
      }
    } catch (error: unknown) {
      logger.error({ error, tenantId, interviewId }, "Failed to notify employer");
      // Ne pas bloquer le processus si la notification échoue
    }
  }

  /**
   * Récupérer les questions d'entretien pour un métier
   */
  private async getInterviewQuestions(_tenantId: number, businessType: string): Promise<InterviewQuestion[]> {
    const questions = await db.query.interviewQuestions.findMany({
      where: and(
        eq(interviewQuestions.businessType, businessType),
        eq(interviewQuestions.isActive, true)
      ),
      orderBy: [interviewQuestions.order],
    });

    return questions.map((q: unknown) => ({
      question: q.question,
      category: q.category,
      expectedKeywords: q.expectedKeywords as string[] | undefined,
      weight: parseFloat(q.weight || "1.0"),
    }));
  }

  /**
   * Récupérer les paramètres de recrutement
   */
  private async getRecruitmentSettings(tenantId: number, businessType: string) {
    return await db.query.recruitmentSettings.findFirst({
      where: and(
        eq(recruitmentSettings.tenantId, tenantId),
        eq(recruitmentSettings.businessType, businessType)
      ),
    });
  }

  /**
   * Générer le script d'entretien pour l'IA
   */
  private generateInterviewScript(
    interview: CandidateInterview,
    questions: InterviewQuestion[],
    settings: unknown): string {
    const intro = settings?.customIntroScript || 
      `Bonjour, je suis l'assistant IA de recrutement. Merci d'avoir postulé pour le poste de ${interview.jobPosition}. Je vais vous poser quelques questions pour mieux vous connaître.`;

    const outro = settings?.customOutroScript || 
      `Merci pour vos réponses. Nous reviendrons vers vous très prochainement. Bonne journée !`;

    const questionsList = questions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");

    return `${intro}\n\n${questionsList}\n\n${outro}`;
  }

  /**
   * Initier un appel IA via Twilio (stub - à implémenter selon votre architecture)
   */
  private async initiateAICall(_phone: string, _script: string, interviewId: number): Promise<string> {
    // TODO: Implémenter l'appel Twilio avec votre service existant
    // Exemple :
    // const call = await twilioService.makeCall({
    //   to: phone,
    //   aiScript: script,
    //   metadata: { interviewId }
    // });
    // return call.sid;

    logger.warn({ interviewId }, "AI call initiation not fully implemented - using mock");
    return `MOCK_CALL_SID_${Date.now()}`;
  }

  /**
   * Mettre à jour le transcript après l'appel
   */
  async updateTranscript(interviewId: number, transcript: string, duration: number): Promise<void> {
    await db.update(candidateInterviews)
      .set({
        transcript,
        duration,
        updatedAt: new Date(),
      })
      .where(eq(candidateInterviews.id, interviewId));

    logger.info({ interviewId }, "Transcript updated");
  }

  /**
   * Récupérer les entretiens d'un tenant avec filtres
   */
  async getInterviews(
    tenantId: number,
    filters?: {
      businessType?: string;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<CandidateInterview[]> {
    const conditions = [eq(candidateInterviews.tenantId, tenantId)];

    if (filters?.businessType) {
      conditions.push(eq(candidateInterviews.businessType, filters.businessType));
    }

    if (filters?.status) {
      conditions.push(eq(candidateInterviews.status, filters.status as unknown));
    }

    if (filters?.dateFrom) {
      conditions.push(gte(candidateInterviews.createdAt, filters.dateFrom));
    }

    if (filters?.dateTo) {
      conditions.push(lte(candidateInterviews.createdAt, filters.dateTo));
    }

    return await db.query.candidateInterviews.findMany({
      where: and(...conditions),
      orderBy: [desc(candidateInterviews.createdAt)],
    });
  }

  /**
   * Récupérer un entretien avec données déchiffrées
   */
  async getInterviewById(interviewId: number, tenantId: number): Promise<any> {
    const interview = await db.query.candidateInterviews.findFirst({
      where: and(
        eq(candidateInterviews.id, interviewId),
        eq(candidateInterviews.tenantId, tenantId)
      ),
    });

    if (!interview) {
      return null;
    }

    // Déchiffrer les données sensibles
    const decryptOpts = { tenantId: tenantId, dataType: 'personal' as const };
    const decryptedName = interview.candidateName 
      ? await encryptionService.decrypt(interview.candidateName, decryptOpts) 
      : null;
    const decryptedEmail = interview.candidateEmail 
      ? await encryptionService.decrypt(interview.candidateEmail, decryptOpts) 
      : null;
    const decryptedPhone = interview.candidatePhone 
      ? await encryptionService.decrypt(interview.candidatePhone, decryptOpts) 
      : null;

    return {
      ...interview,
      candidateName: decryptedName,
      candidateEmail: decryptedEmail,
      candidatePhone: decryptedPhone,
    };
  }
}

export const recruitmentService = new RecruitmentService();
