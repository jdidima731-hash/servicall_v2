import OpenAI from 'openai';
import { AI_MODEL } from '../_core/aiModels';
import { getOpenAIClient } from "../_core/openaiClient";
import { DialogueScenario, DialogueInput, DialogueOutput, ConversationContext } from "../../shared/types/dialogue";
import { getDbInstance } from "../db";
import { prospects, campaigns } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import Redis from "ioredis";
import { ENV } from "../_core/env";
import * as fs from 'fs';
import * as path from 'path';
import { CallCenterScriptLoader } from './CallCenterScriptLoader';
import { logger } from '../core/logger/index';

export class DialogueEngineService {
  private openai: OpenAI;
  private redisClient: Redis | undefined;
  private conversationHistoryPrefix = "conv:";
  private stateHistoryPrefix = "state:";
  private stateStackPrefix = "stack:";
  private auditLogs: any[] = [];
  private rateLimitMap: Map<string, number> = new Map();
  // In-memory fallback maps when Redis is disabled
  private conversationHistory: Map<string, ConversationContext> = new Map();
  private stateHistory: Map<string, string> = new Map();
  private stateStack: Map<string, string[]> = new Map();

  constructor(_apiKey?: string) {
    // ✅ CORRIGÉ: Initialisation OpenAI avec l'API officielle (plus de proxy forge.manus.im)
    this.openai = getOpenAIClient();

    if (!ENV.disableRedis) {
      this.redisClient = new Redis({
        host: ENV.redisHost ?? "localhost",
        port: ENV.redisPort ?? 6379,
        password: ENV.redisPassword,
      });

      this.redisClient.on("error", (err) => {
        logger.error("Redis Client Error", err);
      });

      this.redisClient.on("connect", () => {
        logger.info("Redis Client Connected");
      });
    }
  }

  private logAudit(callId: string, action: string, details: unknown) {
    const entry = { timestamp: new Date(), callId, action, details };
    this.auditLogs.push(entry);
    logger.info(`[AUDIT] [${callId}] ${action}:`, JSON.stringify(details));
  }

  private checkRateLimit(callId: string): boolean {
    const now = Date.now();
    const lastCall = this.rateLimitMap.get(callId) || 0;
    if (now - lastCall < 1000) return false; // 1 req/sec limit
    this.rateLimitMap.set(callId, now);
    return true;
  }

  async initializeConversation(
    callId: string,
    scenario: DialogueScenario,
    tenantId: number,
    prospectId: number
  ): Promise<DialogueOutput> {
    this.logAudit(callId, 'INIT', { scenarioId: scenario.id, tenantId });
    
    const context: ConversationContext = scenario.context || {};
    context.history = [scenario.initialState];

    const db = getDbInstance();

    // Charger les informations du prospect
    const prospectData = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
    if (prospectData.length > 0) {
      context.prospect = prospectData[0];
    }

    // Charger les informations de la campagne (si le scenario.id correspond à une campagne)
    const campaignData = await db.select().from(campaigns).where(eq(campaigns.id, scenario.id)).limit(1);
    if (campaignData.length > 0) {
      context.campaign = campaignData[0];
    }
    
    // Charger le script Call Center si nécessaire
    if (scenario.industry === 'prospection' || scenario.industry === 'juridique' || scenario.industry === 'logistique' || scenario.industry === 'commerce') {
      const scriptLoader = CallCenterScriptLoader.getInstance();
      const script = scriptLoader.getScript(context['activity_type'] || scenario.industry);
      if (script) {
        Object.assign(context, script);
      }
    }

    if (this.redisClient) {
      await this.redisClient.set(`${this.conversationHistoryPrefix}${callId}`, JSON.stringify(context), "EX", 3600); // Expire after 1 hour
      await this.redisClient.set(`${this.stateHistoryPrefix}${callId}`, scenario.initialState, "EX", 3600);
      await this.redisClient.set(`${this.stateStackPrefix}${callId}`, JSON.stringify([scenario.initialState]), "EX", 3600);
    } else {
      // Fallback to in-memory maps if Redis is disabled or failed to connect
      this.conversationHistory.set(callId, context);
      this.stateHistory.set(callId, scenario.initialState);
      this.stateStack.set(callId, [scenario.initialState]);
    }

    const initialState = scenario.states.find((s) => s.id === scenario.initialState)!;
    const actionsExecuted = await this.executeActions(initialState.onEnter, context, tenantId, prospectId, callId);
    const response = await this.generateResponse(initialState.onEnter, context, scenario.industry, callId);

    return { response, nextState: initialState.id, actionsExecuted, context };
  }

  async processInput(
    callId: string,
    input: DialogueInput,
    scenario: DialogueScenario
  ): Promise<DialogueOutput> {
    if (!this.checkRateLimit(callId)) {
      throw new Error("Rate limit exceeded for call " + callId);
    }

    let context: ConversationContext | undefined;
    let currentStateId: string | undefined;
    let stack: string[] = [];

    if (this.redisClient) {
      const contextStr = await this.redisClient.get(`${this.conversationHistoryPrefix}${callId}`);
      const currentStateIdStr = await this.redisClient.get(`${this.stateHistoryPrefix}${callId}`);
      const stackStr = await this.redisClient.get(`${this.stateStackPrefix}${callId}`);

      if (contextStr) context = JSON.parse(contextStr);
      if (currentStateIdStr) currentStateId = currentStateIdStr;
      if (stackStr) stack = JSON.parse(stackStr);
    } else {
      context = this.conversationHistory.get(callId);
      currentStateId = this.stateHistory.get(callId);
      stack = this.stateStack.get(callId) || [];
    }

    if (!context || !currentStateId) throw new Error(`Conversation ${callId} not found`);

    const { intent, entities } = await this.analyzeInput(input.text, scenario.industry, context, callId);
    this.logAudit(callId, 'INPUT', { text: input.text, intent, entities });

    // Fallback transfert humain si trop d'incompréhensions
    if (intent === 'unknown' && context['unknown_count'] > 3) {
      this.logAudit(callId, 'HUMAN_TRANSFER', { reason: 'Too many unknown intents' });
      return { response: "Je vous mets en relation avec un conseiller.", nextState: 'human_transfer', actionsExecuted: [{type: 'transfer_human'}], context };
    }

    // Mise à jour contexte
    Object.assign(context, entities);
    context.lastIntent = intent;
    context['unknown_count'] = intent === 'unknown' ? (context['unknown_count'] || 0) + 1 : 0;

    let nextStateId: string | null = null;
    const currentState = scenario.states.find(s => s.id === currentStateId)!;
    for (const transition of currentState.transitions) {
      if (this.evaluateCondition(transition.condition, context, { intent, entities })) {
        nextStateId = transition.targetState;
        break;
      }
    }

    if (!nextStateId) nextStateId = scenario.fallbackState || currentStateId;

    const nextState = scenario.states.find(s => s.id === nextStateId)!;
    if (nextStateId !== currentStateId) {
      stack.push(nextStateId);
      this.stateStack.set(callId, stack);
    }

    const actionsExecuted = await this.executeActions(nextState.onEnter, context, input.tenantId, input.prospectId, callId);
    const response = await this.generateResponse(nextState.onEnter, context, scenario.industry, callId);

    if (this.redisClient) {
      await this.redisClient.set(`${this.stateHistoryPrefix}${callId}`, nextStateId, "EX", 3600);
      await this.redisClient.set(`${this.conversationHistoryPrefix}${callId}`, JSON.stringify(context), "EX", 3600);
      await this.redisClient.set(`${this.stateStackPrefix}${callId}`, JSON.stringify(stack), "EX", 3600);
    } else {
      this.stateHistory.set(callId, nextStateId);
      this.conversationHistory.set(callId, context);
      context.history = [...stack];
    }

    return { response, nextState: nextStateId, actionsExecuted, context };
  }

  private async analyzeInput(text: string, industry: string, context: unknown, _callId: string): Promise<any> {
    const promptPath = path.join(__dirname, '../ai/prompts/callcenter.system.txt');
    let systemPrompt = "You are a helpful assistant.";
    if (fs.existsSync(promptPath)) {
      systemPrompt = fs.readFileSync(promptPath, 'utf8')
        .replace('{{activity_type}}', context.activity_type || industry)
        .replace('{{objectives}}', JSON.stringify(context.objectives))
        .replace('{{pitch}}', context.pitch)
        .replace('{{bénéfices}}', JSON.stringify(context.bénéfices))
        .replace('{{questions_qualification}}', JSON.stringify(context.questions_qualification))
        .replace('{{objections}}', JSON.stringify(context.objections))
        .replace('{{regles_metier}}', JSON.stringify(context.regles_metier))
        .replace('{{actions_finales}}', JSON.stringify(context.actions_finales));
    }

    const response = await this.openai.chat.completions.create({
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0]!.message.content || "{}");
  }

  private async generateResponse(actions: any[], context: unknown, _industry: string, _callId: string): Promise<string> {
    const speakAction = actions.find(a => a.type === 'speak_to_caller');
    if (!speakAction) return "Je vous écoute.";
    return this.interpolateText(speakAction.config.text, context);
  }

  private evaluateCondition(condition: string, context: unknown, analysis: unknown): boolean {
    try {
      // ✅ SÉCURISÉ: Remplace new Function() par une évaluation sécurisée
      const mergedContext = { ...context, ...analysis };
      return this.evaluateStringCondition(condition, mergedContext);
    } catch (error) {
      logger.error('Condition evaluation error', { condition, error });
      return false;
    }
  }

  /**
   * Évalue une condition string de manière sécurisée (sans eval/new Function)
   */
  private evaluateStringCondition(condition: string, context: unknown): boolean {
    try {
      if (!condition || typeof condition !== 'string') return false;

      const trimmed = condition.trim();
      
      // Cas simple : booléen
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;

      // Vérifier qu'il n'y a pas de code dangereux
      const dangerous = ['eval', 'Function', 'constructor', 'prototype', '__proto__', 'require', 'import'];
      for (const keyword of dangerous) {
        if (trimmed.includes(keyword)) return false;
      }

      // Traiter les opérateurs logiques (&&, ||)
      if (trimmed.includes('||')) {
        return trimmed.split('||').some(part => 
          this.evaluateStringCondition(part.trim(), context)
        );
      }

      if (trimmed.includes('&&')) {
        return trimmed.split('&&').every(part => 
          this.evaluateStringCondition(part.trim(), context)
        );
      }

      // Traiter les opérateurs de comparaison
      const operators = ['===', '!==', '==', '!=', '<=', '>=', '<', '>'];
      for (const op of operators) {
        if (trimmed.includes(op)) {
          const [leftStr, rightStr] = trimmed.split(op).map(s => s.trim());
          if (!leftStr || !rightStr) return false;

          const left = this.parseValue(leftStr, context);
          const right = this.parseValue(rightStr, context);

          return this.compareValues(left, right, op);
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Parse une valeur (variable du contexte ou littéral)
   */
  private parseValue(value: string, context: unknown): unknown {
    const trimmed = value.trim();

    // Littéral string (entre guillemets)
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Littéral number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Littéral booléen
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Variable du contexte (notation pointée)
    return this.getContextValue(trimmed, context);
  }

  /**
   * Récupère une valeur du contexte (supporte la notation pointée)
   */
  private getContextValue(path: string, context: unknown): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Compare deux valeurs avec un opérateur
   */
  private compareValues(left: unknown, right: unknown, operator: string): boolean {
    switch (operator) {
      case '===':
        return left === right;
      case '!==':
        return left !== right;
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '<':
        return (left as number) < (right as number);
      case '>':
        return (left as number) > (right as number);
      case '<=':
        return (left as number) <= (right as number);
      case '>=':
        return (left as number) >= (right as number);
      default:
        return false;
    }
  }

  private async executeActions(actions: any[], context: unknown, _tenantId: number, _prospectId: number, callId: string): Promise<any[]> {
    const executed = [];
    for (const action of actions) {
      this.logAudit(callId, 'ACTION', { type: action.type, config: action.config });
      executed.push({ type: action.type, config: action.config });
      if (action.type === 'update_context') {
        context[action.config.key] = action.config.value;
      }
    }
    return executed;
  }

  private interpolateText(text: string, context: unknown): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => context[key] || match);
  }

  /**
   * Récupère le contexte de conversation pour un appel
   */
  async getConversationContext(callId: string): Promise<ConversationContext | null> {
    if (this.redisClient) {
      const contextStr = await this.redisClient.get(`${this.conversationHistoryPrefix}${callId}`);
      return contextStr ? JSON.parse(contextStr) : null;
    } else {
      return this.conversationHistory.get(callId) || null;
    }
  }

  /**
   * Récupère l'état actuel de la conversation
   */
  async getCurrentState(callId: string): Promise<string | null> {
    if (this.redisClient) {
      return this.redisClient.get(`${this.stateHistoryPrefix}${callId}`);
    } else {
      return this.stateHistory.get(callId) || null;
    }
  }

  /**
   * Termine une conversation et nettoie les ressources
   */
  async endConversation(callId: string): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.del(`${this.conversationHistoryPrefix}${callId}`);
      await this.redisClient.del(`${this.stateHistoryPrefix}${callId}`);
      await this.redisClient.del(`${this.stateStackPrefix}${callId}`);
    } else {
      this.conversationHistory.delete(callId);
      this.stateHistory.delete(callId);
      this.stateStack.delete(callId);
    }
    this.rateLimitMap.delete(callId);
    this.logAudit(callId, 'END_CONVERSATION', { timestamp: new Date() });
  }
}

export default DialogueEngineService;
