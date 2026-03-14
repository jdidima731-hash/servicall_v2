import { DialogueEngineService } from '../services/DialogueEngineService';
import * as fs from 'fs';
import * as path from 'path';

async function testCallCenterEngine() {
  console.log("🧪 Démarrage des tests du moteur Call Center...");
  const engine = new DialogueEngineService();
  const callId = "test-call-123";
  const tenantId = 1;
  const prospectId = 101;

  // Charger le blueprint de prospection
  const blueprintPath = path.join(__dirname, '../../shared/blueprints/prospection.json');
  const scenario = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

  try {
    // 1. Initialisation
    console.log("1. Initialisation de la conversation...");
    const initResult = await engine.initializeConversation(callId, scenario, tenantId, prospectId);
    console.log("Réponse initiale :", initResult.response);

    // 2. Simulation intérêt
    console.log("2. Simulation intérêt utilisateur...");
    const interestResult = await engine.processInput(callId, { text: "Oui, ça m'intéresse.", tenantId, prospectId }, scenario);
    console.log("Réponse intérêt :", interestResult.response);

    // 3. Simulation consentement RGPD
    console.log("3. Simulation consentement RGPD...");
    const rgpdResult = await engine.processInput(callId, { text: "Oui, j'accepte.", tenantId, prospectId }, scenario);
    console.log("Réponse RGPD :", rgpdResult.response);

    // 4. Qualification propriétaire
    console.log("4. Simulation qualification propriétaire...");
    const proprioResult = await engine.processInput(callId, { text: "Oui, je suis propriétaire.", tenantId, prospectId }, scenario);
    console.log("Réponse Propriétaire :", proprioResult.response);

    // 5. Qualification chauffage
    console.log("5. Simulation qualification chauffage...");
    const chauffageResult = await engine.processInput(callId, { text: "Je me chauffe au gaz.", tenantId, prospectId }, scenario);
    console.log("Réponse Chauffage :", chauffageResult.response);
    console.log("Actions exécutées :", JSON.stringify(chauffageResult.actionsExecuted));

    console.log("✅ Tests Call Center terminés avec succès !");
  } catch (error) {
    console.error("❌ Échec des tests :", error);
  }
}

testCallCenterEngine();
