/**
 * Service de Recrutement Amélioré
 * Gestion des CVs, offres d'emploi, matching IA, RDV et exigences client
 * ✅ CORRIGÉ: logger.child() → pinoLogger.child() avec bonne signature, sendEmail avec text requis
 */
import OpenAI from 'openai';
import { AI_MODEL } from '../_core/aiModels';
import { db } from "../db";
import { 
  candidateInterviews, 
  recruitmentJobRequirements,
  recruitmentRdvSlots,
  jobOffers,
} from "../../drizzle/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { getOpenAIClient } from "../_core/openaiClient";
import { pinoLogger } from "../infrastructure/logger";
import { sendEmail } from "./notificationService";

// ✅ FIX: Utiliser pinoLogger.child() directement pour avoir la bonne signature Pino (obj, msg)
const logger = pinoLogger.child({ service: "RecruitmentServiceEnhanced" });

interface CVParseResult {
  skills: string[];
  experience: { title: string; company: string; duration: string; description?: string }[];
  education: { degree: string; institution: string; year?: string }[];
  languages: string[];
  summary?: string;
  yearsOfExperience?: number;
  salary?: string;
  availability?: string;
  location?: string;
}

interface MatchingResult {
  matchingScore: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  salaryMatch: number;
  overallFit: string;
  strengths: string[];
  gaps: string[];
}

interface AIGeneratedProfile {
  requiredSkills: string[];
  preferredSkills: string[];
  minExperience: number;
  educationLevel: string;
  personalityTraits: string[];
  dealBreakers: string[];
  salaryRange?: string;
  contractType?: string;
  workMode?: string;
  keywords: string[];
  scoringCriteria: {
    criterion: string;
    weight: number;
    description: string;
  }[];
}

export class RecruitmentServiceEnhanced {
  private openai: OpenAI;

  constructor() {
    this.openai = getOpenAIClient();
  }

  /**
   * Parser un CV en base64 et extraire les informations
   */
  async parseCV(cvBase64: string, fileName: string): Promise<CVParseResult> {
    try {
      logger.info({ fileName }, "[Recruitment] Parsing CV");

      const systemPrompt = `Tu es un expert en analyse de CV. Extrais les informations suivantes du CV fourni en format JSON:
- skills: array de compétences
- experience: array d'objets {title, company, duration, description}
- education: array d'objets {degree, institution, year}
- languages: array de langues
- summary: résumé du profil
- yearsOfExperience: nombre d'années
- salary: salaire attendu si mentionné
- availability: disponibilité si mentionnée
- location: localisation si mentionnée

Réponds UNIQUEMENT avec du JSON valide, sans texte supplémentaire.`;

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Analyse ce CV (base64): ${cvBase64.substring(0, 100)}...`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);

      return {
        skills: parsed.skills || [],
        experience: parsed.experience || [],
        education: parsed.education || [],
        languages: parsed.languages || [],
        summary: parsed.summary,
        yearsOfExperience: parsed.yearsOfExperience,
        salary: parsed.salary,
        availability: parsed.availability,
        location: parsed.location,
      };
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to parse CV");
      throw error;
    }
  }

  /**
   * Générer un profil idéal basé sur les exigences du client
   */
  async generateProfileFromRequirements(
    tenantId: number,
    jobTitle: string,
    clientRequirements: string
  ): Promise<AIGeneratedProfile> {
    try {
      logger.info({ jobTitle, tenantId }, "[Recruitment] Generating ideal profile");

      const systemPrompt = `Tu es un expert en recrutement et en définition de profils candidats. 
Basé sur les exigences du client, génère un profil candidat idéal en JSON avec:
- requiredSkills: compétences obligatoires
- preferredSkills: compétences appréciées
- minExperience: années d'expérience minimum
- educationLevel: niveau d'études requis
- personalityTraits: traits de personnalité recherchés
- dealBreakers: critères éliminatoires
- salaryRange: fourchette salariale
- contractType: type de contrat
- workMode: mode de travail (onsite/remote/hybrid)
- keywords: mots-clés de recherche
- scoringCriteria: array d'objets {criterion, weight (0-100), description}

Réponds UNIQUEMENT avec du JSON valide.`;

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Poste: ${jobTitle}\n\nExigences du client:\n${clientRequirements}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });

      const content = response.choices[0]?.message?.content || "{}";
      return JSON.parse(content);
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to generate profile");
      throw error;
    }
  }

  /**
   * Matcher un candidat avec une offre d'emploi
   */
  async matchCandidateWithJob(
    tenantId: number,
    candidateCV: CVParseResult,
    jobProfile: AIGeneratedProfile
  ): Promise<MatchingResult> {
    try {
      logger.info({ tenantId }, "[Recruitment] Matching candidate with job");

      const systemPrompt = `Tu es un expert en matching candidat-poste. Analyse le candidat et le profil idéal.
Réponds avec un JSON contenant:
- matchingScore: score global 0-100
- skillsMatch: score des compétences 0-100
- experienceMatch: score expérience 0-100
- educationMatch: score éducation 0-100
- salaryMatch: score salaire 0-100
- overallFit: "excellent" | "good" | "fair" | "poor"
- strengths: array de points forts
- gaps: array de lacunes

Réponds UNIQUEMENT avec du JSON valide.`;

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `CV du candidat:\n${JSON.stringify(candidateCV, null, 2)}\n\nProfil idéal:\n${JSON.stringify(jobProfile, null, 2)}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content || "{}";
      return JSON.parse(content);
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to match candidate");
      throw error;
    }
  }

  /**
   * Créer une offre d'emploi
   */
  async createJobOffer(data: {
    tenantId: number;
    title: string;
    description: string;
    department?: string;
    location?: string;
    salaryRange?: string;
    contractType?: string;
    skillsRequired?: string[];
    experienceYears?: number;
    educationLevel?: string;
    remoteWork?: string;
    priority?: string;
    positionsCount?: number;
  }): Promise<any> {
    try {
      logger.info({ tenantId: data.tenantId, title: data.title }, "[Recruitment] Creating job offer");

      const result = await db.insert(jobOffers).values({
        tenantId: data.tenantId,
        title: data.title,
        description: data.description,
        department: data.department,
        location: data.location,
        salaryRange: data.salaryRange,
        contractType: data.contractType,
        skillsRequired: data.skillsRequired as unknown,
        experienceYears: data.experienceYears,
        educationLevel: data.educationLevel,
        remoteWork: data.remoteWork,
        priority: data.priority,
        positionsCount: data.positionsCount,
        isActive: true,
      }).returning();

      return result[0];
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to create job offer");
      throw error;
    }
  }

  /**
   * Mettre à jour une offre d'emploi
   */
  async updateJobOffer(jobOfferId: number, tenantId: number, data: unknown): Promise<any> {
    try {
      logger.info({ jobOfferId, tenantId }, "[Recruitment] Updating job offer");

      const result = await db.update(jobOffers)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(
          eq(jobOffers.id, jobOfferId),
          eq(jobOffers.tenantId, tenantId)
        ))
        .returning();

      return result[0];
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to update job offer");
      throw error;
    }
  }

  /**
   * Récupérer les offres d'emploi
   */
  async getJobOffers(tenantId: number, filters?: unknown): Promise<any[]> {
    try {
      const conditions = [
        eq(jobOffers.tenantId, tenantId),
        eq(jobOffers.isActive, true),
      ];

      if (filters?.priority) {
        conditions.push(eq(jobOffers.priority, filters.priority));
      }

      return await db.query.jobOffers.findMany({
        where: and(...conditions),
        orderBy: [desc(jobOffers.createdAt)],
      });
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to get job offers");
      throw error;
    }
  }

  /**
   * Créer une exigence client et générer le profil IA
   */
  async createJobRequirement(data: {
    tenantId: number;
    jobOfferId?: number;
    title: string;
    clientRequirementsRaw: string;
  }): Promise<any> {
    try {
      logger.info({ tenantId: data.tenantId }, "[Recruitment] Creating job requirement");

      // Générer le profil IA
      const aiGeneratedProfile = await this.generateProfileFromRequirements(
        data.tenantId,
        data.title,
        data.clientRequirementsRaw
      );

      // Créer l'enregistrement
      const result = await db.insert(recruitmentJobRequirements).values({
        tenantId: data.tenantId,
        jobOfferId: data.jobOfferId,
        title: data.title,
        clientRequirementsRaw: data.clientRequirementsRaw,
        aiGeneratedProfile: aiGeneratedProfile as unknown,
        conversationHistory: [] as unknown,
        status: "active",
      }).returning();

      return result[0];
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to create job requirement");
      throw error;
    }
  }

  /**
   * Ajouter un message à la conversation avec l'IA
   */
  async addConversationMessage(
    requirementId: number,
    tenantId: number,
    role: "user" | "assistant",
    content: string
  ): Promise<any> {
    try {
      logger.info({ requirementId, tenantId }, "[Recruitment] Adding conversation message");

      // Récupérer l'exigence
      const requirement = await db.query.recruitmentJobRequirements.findFirst({
        where: and(
          eq(recruitmentJobRequirements.id, requirementId),
          eq(recruitmentJobRequirements.tenantId, tenantId)
        ),
      });

      if (!requirement) {
        throw new Error("Job requirement not found");
      }

      // Mettre à jour l'historique
      const history = (requirement.conversationHistory as unknown[]) || [];
      history.push({
        role,
        content,
        timestamp: new Date().toISOString(),
      });

      const result = await db.update(recruitmentJobRequirements)
        .set({
          conversationHistory: history as unknown,
          updatedAt: new Date(),
        })
        .where(eq(recruitmentJobRequirements.id, requirementId))
        .returning();

      return result[0];
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to add conversation message");
      throw error;
    }
  }

  /**
   * Chat avec l'IA pour affiner les exigences
   */
  async chatWithAI(
    requirementId: number,
    tenantId: number,
    userMessage: string
  ): Promise<{ message: string; updatedProfile?: AIGeneratedProfile }> {
    try {
      logger.info({ tenantId, requirementId }, "[Recruitment] Chat with AI");

      const requirement = await db.query.recruitmentJobRequirements.findFirst({
        where: and(
          eq(recruitmentJobRequirements.id, requirementId),
          eq(recruitmentJobRequirements.tenantId, tenantId)
        ),
      });

      if (!requirement) {
        throw new Error("Job requirement not found");
      }

      // Ajouter le message utilisateur
      await this.addConversationMessage(requirementId, tenantId, "user", userMessage);

      const history = (requirement.conversationHistory as unknown[]) || [];
      const systemPrompt = `Tu es un expert en recrutement qui aide à affiner les exigences d'un poste.
Profil actuel: ${JSON.stringify(requirement.aiGeneratedProfile, null, 2)}

Aide le client à préciser ses besoins. Si le client demande une modification du profil, 
réponds avec un JSON contenant:
- message: ta réponse textuelle
- updatedProfile: le profil mis à jour (si modification demandée)

Sinon, réponds avec:
- message: ta réponse textuelle

Réponds UNIQUEMENT avec du JSON valide.`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.slice(-10).map((h: unknown) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user" as const, content: userMessage },
      ];

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '{"message": "Je suis désolé, je n\'ai pas pu traiter votre demande."}';
      const result = JSON.parse(content);

      // Ajouter la réponse IA à l'historique
      await this.addConversationMessage(requirementId, tenantId, "assistant", result.message);

      // Mettre à jour le profil si modifié
      if (result.updatedProfile) {
        await db.update(recruitmentJobRequirements)
          .set({
            aiGeneratedProfile: result.updatedProfile as unknown,
            updatedAt: new Date(),
          })
          .where(eq(recruitmentJobRequirements.id, requirementId));
      }

      return result;
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to chat with AI");
      throw error;
    }
  }

  /**
   * Créer un créneau RDV
   */
  async createRdvSlot(data: {
    tenantId: number;
    slotDate: Date;
    slotDuration?: number;
    assignedTo?: string;
    interviewType?: string;
    notes?: string;
  }): Promise<any> {
    try {
      logger.info({ tenantId: data.tenantId }, "[Recruitment] Creating RDV slot");

      const result = await db.insert(recruitmentRdvSlots).values({
        tenantId: data.tenantId,
        slotDate: data.slotDate,
        slotDuration: data.slotDuration ?? 60,
        assignedTo: data.assignedTo,
        interviewType: data.interviewType ?? "phone",
        notes: data.notes,
        isAvailable: true,
      }).returning();

      return result[0];
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to create RDV slot");
      throw error;
    }
  }

  /**
   * Récupérer les créneaux disponibles
   */
  async getAvailableSlots(tenantId: number, fromDate: Date, toDate: Date): Promise<any[]> {
    try {
      return await db.query.recruitmentRdvSlots.findMany({
        where: and(
          eq(recruitmentRdvSlots.tenantId, tenantId),
          eq(recruitmentRdvSlots.isAvailable, true),
          gte(recruitmentRdvSlots.slotDate, fromDate),
          lte(recruitmentRdvSlots.slotDate, toDate)
        ),
        orderBy: [recruitmentRdvSlots.slotDate],
      });
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to get available slots");
      throw error;
    }
  }

  /**
   * Réserver un créneau pour un entretien
   */
  async bookRdvSlot(slotId: number, tenantId: number, interviewId: number): Promise<any> {
    try {
      logger.info({ slotId, tenantId, interviewId }, "[Recruitment] Booking RDV slot");

      const result = await db.update(recruitmentRdvSlots)
        .set({
          isAvailable: false,
          interviewId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(recruitmentRdvSlots.id, slotId),
          eq(recruitmentRdvSlots.tenantId, tenantId)
        ))
        .returning();

      return result[0];
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to book RDV slot");
      throw error;
    }
  }

  /**
   * Envoyer un candidat au client
   */
  async sendCandidateToClient(
    interviewId: number,
    tenantId: number,
    clientEmail: string
  ): Promise<void> {
    try {
      logger.info({ interviewId, tenantId }, "[Recruitment] Sending candidate to client");

      // Récupérer l'entretien
      const interview = await db.query.candidateInterviews.findFirst({
        where: and(
          eq(candidateInterviews.id, interviewId),
          eq(candidateInterviews.tenantId, tenantId)
        ),
      });

      if (!interview) {
        throw new Error("Interview not found");
      }

      // Mettre à jour le statut
      await db.update(candidateInterviews)
        .set({
          sentToClient: true,
          sentToClientAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(candidateInterviews.id, interviewId));

      // ✅ FIX: Ajout du champ 'text' requis par sendEmail
      const htmlContent = `
        <h2>Profil Candidat</h2>
        <p><strong>Nom:</strong> ${interview.candidateName}</p>
        <p><strong>Poste:</strong> ${interview.jobPosition}</p>
        <p><strong>Score IA:</strong> ${interview.aiConfidence}%</p>
        <p><strong>Recommandation:</strong> ${interview.aiRecommendation}</p>
        <p><strong>Résumé:</strong></p>
        <p>${interview.aiSummary}</p>
      `;
      await sendEmail({
        to: clientEmail,
        subject: `Profil candidat: ${interview.candidateName}`,
        text: `Profil Candidat\nNom: ${interview.candidateName}\nPoste: ${interview.jobPosition}\nScore IA: ${interview.aiConfidence}%\nRecommandation: ${interview.aiRecommendation}\nRésumé: ${interview.aiSummary}`,
        html: htmlContent,
      });

      logger.info({ interviewId, clientEmail }, "[Recruitment] Candidate sent to client");
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to send candidate to client");
      throw error;
    }
  }

  /**
   * Mettre à jour la décision du client
   */
  async updateClientDecision(
    interviewId: number,
    tenantId: number,
    decision: "accepted" | "rejected" | "pending",
    feedback?: string
  ): Promise<any> {
    try {
      logger.info({ interviewId, tenantId, decision }, "[Recruitment] Updating client decision");

      const result = await db.update(candidateInterviews)
        .set({
          clientDecision: decision,
          clientFeedback: feedback,
          updatedAt: new Date(),
        })
        .where(and(
          eq(candidateInterviews.id, interviewId),
          eq(candidateInterviews.tenantId, tenantId)
        ))
        .returning();

      return result[0];
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to update client decision");
      throw error;
    }
  }

  /**
   * Obtenir les statistiques du recrutement
   */
  async getRecruitmentStats(tenantId: number, filters?: unknown): Promise<any> {
    try {
      const conditions = [eq(candidateInterviews.tenantId, tenantId)];

      if (filters?.businessType) {
        conditions.push(eq(candidateInterviews.businessType, filters.businessType));
      }

      const interviews = await db.query.candidateInterviews.findMany({
        where: and(...conditions),
      });

      const sentToClient = interviews.filter((i: unknown) => i.sentToClient).length;
      const accepted = interviews.filter((i: unknown) => i.clientDecision === "accepted").length;
      const rejected = interviews.filter((i: unknown) => i.clientDecision === "rejected").length;

      return {
        total: interviews.length,
        sentToClient,
        accepted,
        rejected,
        pending: sentToClient - accepted - rejected,
        averageMatchingScore:
          interviews
            .filter((i: unknown) => i.matchingScore)
            .reduce((acc: number, i: unknown) => acc + (i.matchingScore ?? 0), 0) /
          (interviews.filter((i: unknown) => i.matchingScore).length ?? 1),
      };
    } catch (error: unknown) {
      logger.error({ error }, "[Recruitment] Failed to get stats");
      throw error;
    }
  }
}

export const recruitmentServiceEnhanced = new RecruitmentServiceEnhanced();
