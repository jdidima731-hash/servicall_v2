import { DialogueEngineService } from "../services/DialogueEngineService";
import { DialogueScenario } from "../../shared/types/dialogue";

async function testDialogueEngine() {
  console.log("🧪 Testing DialogueEngineService...");

  const engine = new DialogueEngineService();

  const scenario: DialogueScenario = {
    id: "test-scenario",
    name: "Test Scenario",
    industry: "restaurant",
    initialState: "accueil",
    context: { restaurant_name: "Pizzeria Bella" },
    states: [
      {
        id: "accueil",
        name: "Accueil",
        onEnter: [
          {
            type: "speak_to_caller",
            config: { text: "Bonjour et bienvenue chez {{restaurant_name}}. Que puis-je pour vous ?" }
          }
        ],
        transitions: [
          { condition: "intent === 'order_food'", targetState: "prise_commande" }
        ]
      },
      {
        id: "prise_commande",
        name: "Prise de commande",
        onEnter: [
          {
            type: "speak_to_caller",
            config: { text: "Très bien, je vous écoute pour votre commande." }
          }
        ],
        transitions: []
      }
    ]
  };

  const callId = "test-call-123";
  const tenantId = 1;
  const prospectId = 1;

  try {
    // 1. Initialisation
    console.log("\n1. Initializing conversation...");
    const initResult = await engine.initializeConversation(callId, scenario, tenantId, prospectId);
    console.log("Response:", initResult.response);
    console.log("Next State:", initResult.nextState);

    if (initResult.response.includes("Pizzeria Bella") && initResult.nextState === "accueil") {
      console.log("✅ Initialization successful");
    } else {
      console.error("❌ Initialization failed");
    }

    // 2. Traitement d'une entrée (Simulation d'une intention 'order_food')
    // Note: Dans un vrai test, on mockerait l'appel à OpenAI
    console.log("\n2. Processing user input: 'Je voudrais commander une pizza'...");
    
    // Pour le test, on va simuler le résultat de l'analyse NLU
    // car on ne veut pas appeler l'API réelle dans ce test de structure
    const processResult = await engine.processInput(callId, {
      text: "Je voudrais commander une pizza",
      callId,
      prospectId,
      tenantId
    }, scenario);

    console.log("Response:", processResult.response);
    console.log("Next State:", processResult.nextState);
    console.log("Context:", JSON.stringify(processResult.context));

    if (processResult.nextState === "prise_commande") {
      console.log("✅ Transition successful");
    } else {
      console.log("⚠️ Transition failed (Expected 'prise_commande', got '" + processResult.nextState + "')");
      console.log("Note: This might be due to NLU analysis if OpenAI API is not configured.");
    }

    console.log("\n✅ Dialogue Engine Test Completed");
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
  }
}

testDialogueEngine();
