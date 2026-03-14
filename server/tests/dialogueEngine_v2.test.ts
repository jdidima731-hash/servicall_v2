import { DialogueEngineService } from "../services/DialogueEngineService";
import { DialogueScenario } from "../../shared/types/dialogue";

async function runTests() {
  console.log("🚀 Starting DialogueEngineService V2 Tests...");
  const service = new DialogueEngineService();
  
  const scenario: DialogueScenario = {
    id: "test-scenario",
    name: "Test Restaurant",
    industry: "restaurant",
    initialState: "welcome",
    fallbackState: "fallback",
    states: [
      {
        id: "welcome",
        name: "Welcome State",
        onEnter: [{ type: "speak_to_caller", config: { text: "Bienvenue au restaurant. Que voulez-vous commander ?" } }],
        transitions: [{ condition: "intent === 'order_food'", targetState: "ordering" }]
      },
      {
        id: "ordering",
        name: "Ordering State",
        onEnter: [{ type: "speak_to_caller", config: { text: "Très bien, quel plat voulez-vous ?" } }],
        transitions: [
          { condition: "intent === 'confirm'", targetState: "validation" },
          { condition: "intent === 'cancel'", targetState: "welcome" }
        ]
      },
      {
        id: "fallback",
        name: "Fallback State",
        onEnter: [{ type: "speak_to_caller", config: { text: "Je suis désolé, je n'ai pas compris. Pouvez-vous répéter ?" } }],
        transitions: [{ condition: "true", targetState: "welcome" }]
      },
      {
        id: "validation",
        name: "Validation State",
        onEnter: [{ type: "speak_to_caller", config: { text: "C'est noté. Votre commande est validée." } }],
        transitions: []
      }
    ]
  };

  try {
    // Test 1: Initialization
    console.log("\n--- Test 1: Initialization ---");
    const output1 = await service.initializeConversation("call-1", scenario, 1, 1);
    console.log("Next State:", output1.nextState);
    console.log("Response:", output1.response);
    if (output1.nextState === "welcome") console.log("✅ Passed"); else throw new Error("Failed");

    // Test 2: Transition
    console.log("\n--- Test 2: Transition to ordering ---");
    const output2 = await service.processInput("call-1", { text: "Je voudrais commander une pizza", callId: "call-1", tenantId: 1, prospectId: 1 }, scenario);
    console.log("Next State:", output2.nextState);
    console.log("Response:", output2.response);
    if (output2.nextState === "ordering") console.log("✅ Passed"); else throw new Error("Failed");

    // Test 3: Backtrack
    console.log("\n--- Test 3: Backtrack ---");
    const output3 = await service.processInput("call-1", { text: "En fait je veux revenir au début", callId: "call-1", tenantId: 1, prospectId: 1 }, scenario);
    console.log("Next State:", output3.nextState);
    console.log("Response:", output3.response);
    if (output3.nextState === "welcome") console.log("✅ Passed"); else throw new Error("Failed");

    // Test 4: Fallback
    console.log("\n--- Test 4: Fallback ---");
    const output4 = await service.processInput("call-1", { text: "Bla bla bla", callId: "call-1", tenantId: 1, prospectId: 1 }, scenario);
    console.log("Next State:", output4.nextState);
    console.log("Response:", output4.response);
    if (output4.nextState === "fallback") console.log("✅ Passed"); else throw new Error("Failed");

    console.log("\n🎉 All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

runTests();
