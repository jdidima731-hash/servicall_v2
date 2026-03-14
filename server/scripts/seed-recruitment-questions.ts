/**
 * Script de seed pour les questions d'entretien par métier
 * Ajoute des questions universelles et spécifiques par type de business
 */

import { db } from "../db";
import { interviewQuestions } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

const defaultQuestions = [
  // Questions pour secrétaire médical
  {
    businessType: "medical_secretary",
    category: "technical",
    question: "Avez-vous de l'expérience avec les logiciels de gestion de cabinet médical ?",
    expectedAnswerType: "open",
    expectedKeywords: ["logiciel", "doctolib", "maiia", "médical", "planning"],
    weight: 1.5,
    order: 1,
  },
  {
    businessType: "medical_secretary",
    category: "technical",
    question: "Comment gérez-vous la prise de rendez-vous et les urgences ?",
    expectedAnswerType: "open",
    expectedKeywords: ["priorité", "urgence", "organisation", "planning"],
    weight: 1.3,
    order: 2,
  },
  {
    businessType: "medical_secretary",
    category: "behavioral",
    question: "Comment réagissez-vous face à un patient stressé ou anxieux ?",
    expectedAnswerType: "open",
    expectedKeywords: ["calme", "écoute", "empathie", "rassurer"],
    weight: 1.4,
    order: 3,
  },
  {
    businessType: "medical_secretary",
    category: "situational",
    question: "Que faites-vous si deux patients réclament le même créneau urgent ?",
    expectedAnswerType: "open",
    expectedKeywords: ["priorité", "médecin", "négociation", "solution"],
    weight: 1.2,
    order: 4,
  },

  // Questions pour serveur de restaurant
  {
    businessType: "restaurant_server",
    category: "technical",
    question: "Avez-vous déjà travaillé avec un système de caisse ou de commande numérique ?",
    expectedAnswerType: "yes_no",
    expectedKeywords: ["caisse", "pos", "tablette", "commande"],
    weight: 1.2,
    order: 1,
  },
  {
    businessType: "restaurant_server",
    category: "technical",
    question: "Comment mémorisez-vous les commandes de plusieurs tables simultanément ?",
    expectedAnswerType: "open",
    expectedKeywords: ["méthode", "organisation", "mémoire", "notes"],
    weight: 1.3,
    order: 2,
  },
  {
    businessType: "restaurant_server",
    category: "behavioral",
    question: "Comment gérez-vous un client mécontent de son plat ?",
    expectedAnswerType: "open",
    expectedKeywords: ["écoute", "solution", "chef", "remplacer", "excuses"],
    weight: 1.5,
    order: 3,
  },
  {
    businessType: "restaurant_server",
    category: "situational",
    question: "Que faites-vous si la cuisine prend du retard et les clients s'impatientent ?",
    expectedAnswerType: "open",
    expectedKeywords: ["communication", "informer", "geste commercial", "patience"],
    weight: 1.2,
    order: 4,
  },

  // Questions pour réceptionniste d'hôtel
  {
    businessType: "hotel_receptionist",
    category: "technical",
    question: "Connaissez-vous des logiciels de gestion hôtelière (PMS) ?",
    expectedAnswerType: "open",
    expectedKeywords: ["pms", "opera", "mews", "réservation", "logiciel"],
    weight: 1.4,
    order: 1,
  },
  {
    businessType: "hotel_receptionist",
    category: "technical",
    question: "Comment gérez-vous les check-in et check-out en période de forte affluence ?",
    expectedAnswerType: "open",
    expectedKeywords: ["organisation", "rapidité", "efficacité", "priorité"],
    weight: 1.3,
    order: 2,
  },
  {
    businessType: "hotel_receptionist",
    category: "behavioral",
    question: "Un client arrive fatigué après un long voyage et sa chambre n'est pas prête. Comment réagissez-vous ?",
    expectedAnswerType: "open",
    expectedKeywords: ["solution", "attente", "confort", "upgrade", "excuses"],
    weight: 1.5,
    order: 3,
  },
  {
    businessType: "hotel_receptionist",
    category: "situational",
    question: "Comment gérez-vous une réclamation concernant le bruit dans une chambre ?",
    expectedAnswerType: "open",
    expectedKeywords: ["écoute", "changement", "chambre", "solution", "compensation"],
    weight: 1.2,
    order: 4,
  },

  // Questions pour commercial
  {
    businessType: "sales_representative",
    category: "technical",
    question: "Quelle est votre approche pour prospecter de nouveaux clients ?",
    expectedAnswerType: "open",
    expectedKeywords: ["prospection", "méthode", "réseau", "cold calling", "linkedin"],
    weight: 1.5,
    order: 1,
  },
  {
    businessType: "sales_representative",
    category: "technical",
    question: "Comment structurez-vous votre argumentaire de vente ?",
    expectedAnswerType: "open",
    expectedKeywords: ["besoins", "écoute", "solution", "objections", "closing"],
    weight: 1.4,
    order: 2,
  },
  {
    businessType: "sales_representative",
    category: "behavioral",
    question: "Comment gérez-vous un refus ou une objection client ?",
    expectedAnswerType: "open",
    expectedKeywords: ["rebond", "écoute", "reformulation", "persévérance"],
    weight: 1.3,
    order: 3,
  },
  {
    businessType: "sales_representative",
    category: "situational",
    question: "Un concurrent propose un prix inférieur. Comment réagissez-vous ?",
    expectedAnswerType: "open",
    expectedKeywords: ["valeur", "différenciation", "qualité", "service", "avantages"],
    weight: 1.4,
    order: 4,
  },

  // Questions universelles (applicables à tous les métiers)
  {
    businessType: "universal",
    category: "behavioral",
    question: "Pourquoi souhaitez-vous travailler dans ce secteur ?",
    expectedAnswerType: "open",
    expectedKeywords: ["motivation", "passion", "intérêt", "carrière"],
    weight: 1.1,
    order: 1,
  },
  {
    businessType: "universal",
    category: "behavioral",
    question: "Quelles sont vos principales qualités professionnelles ?",
    expectedAnswerType: "open",
    expectedKeywords: ["qualité", "compétence", "force", "atout"],
    weight: 1.0,
    order: 2,
  },
  {
    businessType: "universal",
    category: "behavioral",
    question: "Comment gérez-vous le stress et la pression au travail ?",
    expectedAnswerType: "open",
    expectedKeywords: ["gestion", "stress", "organisation", "méthode", "calme"],
    weight: 1.2,
    order: 3,
  },
  {
    businessType: "universal",
    category: "situational",
    question: "Décrivez une situation difficile que vous avez résolue dans un précédent emploi.",
    expectedAnswerType: "open",
    expectedKeywords: ["problème", "solution", "résultat", "action"],
    weight: 1.3,
    order: 4,
  },
  {
    businessType: "universal",
    category: "behavioral",
    question: "Quelles sont vos disponibilités et vos attentes salariales ?",
    expectedAnswerType: "open",
    expectedKeywords: ["disponibilité", "salaire", "horaires", "flexibilité"],
    weight: 1.0,
    order: 5,
  },
];

async function main() {
  try {
    logger.info("[Seed] Starting recruitment questions seed");

    // Insérer les questions (tenant_id = null pour questions universelles)
    for (const question of defaultQuestions) {
      await db.insert(interviewQuestions).values({
        tenantId: null, // Questions universelles accessibles à tous les tenants
        businessType: question.businessType,
        category: question.category,
        question: question.question,
        expectedAnswerType: question.expectedAnswerType as unknown,
        expectedKeywords: question.expectedKeywords as unknown,
        weight: question.weight.toString(),
        order: question.order,
        isActive: true,
      });
    }

    logger.info("[Seed] Recruitment questions seeded successfully", {
      count: defaultQuestions.length,
    });

    process.exit(0);
  } catch (error: unknown) {
    logger.error("[Seed] Failed to seed recruitment questions", { error });
    process.exit(1);
  }
}

main();
