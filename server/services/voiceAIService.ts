import { WebSocket } from 'ws';
import { logger } from '../infrastructure/logger';
import { invokeLLM } from "../_core/llm";
import { AI_MODEL } from "../_core/aiModels";
import { synthesizeSpeech } from './ttsService';
import { processAgentActions, ToolCall } from './agentActionService';
import { flexibleCallService } from './flexibleCallService';

/**
 * Handle Twilio Media Stream via WebSocket
 * This service manages the real-time conversation between the caller and the AI agent
 */
export function handleVoiceStream(ws: WebSocket) {
  let streamSid: string;
  let callSid: string;
  let conversationHistory: any[] = [];
  let isProcessing = false;
  const callId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  ws.on('message', async (data: string) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          logger.info('[Voice AI] Stream started', { callId, streamSid, callSid });
          
          // Initialize conversation with system prompt specialized for IT Support
          conversationHistory = [
            {
              role: 'system',
              content: `Tu es un expert en assistance informatique pour Servicall IT. 
              Ton rôle est de diagnostiquer les problèmes techniques des clients en temps réel et de proposer des solutions concises.
              
              DIRECTIVES :
              1. Pose des questions de diagnostic précises une par une.
              2. Propose des solutions immédiates (redémarrage, vérification câbles, etc.).
              3. Utilise 'diagnoseITIssue' dès que tu as assez d'infos pour structurer le problème.
              4. En fin d'appel, utilise 'generateITInvoice' pour facturer l'intervention.
              5. Si le problème est trop complexe, utilise 'transferToHumanAgent'.
              6. Sois très concis, c'est une conversation téléphonique.`,
            }
          ];
          
          // Initial greeting
          await sendAIResponse(ws, "Service d'assistance informatique Servicall, bonjour. Quel est votre problème technique ?", conversationHistory, callId);
          break;

        case 'media':
          // Audio processing would go here
          break;

        case 'transcription':
          if (msg.text && !isProcessing) {
            isProcessing = true;
            const startTime = Date.now();
            try {
              await processUserMessage(ws, msg.text, conversationHistory, callId);
            } finally {
              isProcessing = false;
              logger.info('[Voice AI] Message processing completed', { 
                callId, 
                duration_ms: Date.now() - startTime 
              });
            }
          }
          break;

        case 'stop':
          logger.info('[Voice AI] Stream stopped', { callId, streamSid });
          flexibleCallService.endCall(callSid);
          break;

        default:
          logger.debug('[Voice AI] Received unhandled event', { callId, event: msg.event });
      }
    } catch (error: unknown) {
      logger.error('[Voice AI] Error processing WebSocket message', error, { callId });
    }
  });

  ws.on('error', (error) => {
    logger.error('[Voice AI] WebSocket error', error, { callId });
  });

  ws.on('close', () => {
    logger.info('[Voice AI] WebSocket connection closed', { callId });
  });
}

/**
 * Process a message from the user
 */
async function processUserMessage(ws: WebSocket, text: string, history: any[], callId: string) {
  logger.info('[Voice AI] User message received', { callId, textLength: text.length });
  history.push({ role: 'user', content: text });

  try {
    // ✅ BLOC 1 FIX (TS2554) : invokeLLM requiert (tenantId: number, params: InvokeParams)
    // Ce service WebSocket n'a pas de contexte tenant direct ; utilise 1 comme valeur par défaut
    const response = await invokeLLM(1, {
      model: AI_MODEL.DEFAULT,
      messages: history,
      tools: [
        {
          type: 'function',
          function: {
            name: 'diagnoseITIssue',
            description: 'Enregistrer un diagnostic informatique et obtenir des suggestions',
            parameters: {
              type: 'object',
              properties: {
                problemDescription: { type: 'string', description: 'Description détaillée du problème' },
                category: { type: 'string', enum: ['network', 'hardware', 'software', 'email', 'other'] },
                severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              },
              required: ['problemDescription'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'generateITInvoice',
            description: 'Générer une facture pour l\'assistance fournie',
            parameters: {
              type: 'object',
              properties: {
                amount: { type: 'number', description: 'Montant total HT' },
                items: { 
                  type: 'array', 
                  items: {
                    type: 'object',
                    properties: {
                      description: { type: 'string' },
                      price: { type: 'number' }
                    }
                  }
                },
                currency: { type: 'string', default: 'EUR' }
              },
              required: ['amount'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'transferToHumanAgent',
            description: 'Transférer l\'appel à un technicien humain',
            parameters: {
              type: 'object',
              properties: {
                reason: { type: 'string', description: 'Raison du transfert' },
              },
              required: ['reason'],
            },
          },
        }
      ],
    });

    const message = response.choices?.[0]?.message;
    if (!message) {
      logger.error('[Voice AI] No message in LLM response', { callId });
      await sendAIResponse(ws, "Désolé, je n'ai pas pu traiter votre demande.", history, callId);
      return;
    }

    if (message.tool_calls) {
      const toolResults = await processAgentActions(message.tool_calls as ToolCall[], { callId });
      history.push(message);
      history.push(...toolResults);
      
      // ✅ BLOC 1 FIX (TS2554)
      const finalResponse = await invokeLLM(1, { 
        model: AI_MODEL.DEFAULT, 
        messages: history 
      });
      
      const finalContent = typeof finalResponse.choices?.[0]?.message?.content === 'string' 
        ? finalResponse.choices[0].message.content 
        : "Action terminée.";
        
      await sendAIResponse(ws, finalContent, history, callId);
    } else {
      const content = typeof message?.content === 'string' ? message.content : "Comment puis-je vous aider ?";
      await sendAIResponse(ws, content, history, callId);
    }
  } catch (error: unknown) {
    logger.error('[Voice AI] Error in LLM processing', error, { callId });
    await sendAIResponse(ws, "Je rencontre une difficulté technique. Je vous propose de planifier un rappel.", history, callId);
  }
}

/**
 * Send AI response back to Twilio
 */
async function sendAIResponse(ws: WebSocket, text: string, history: any[], callId: string) {
  const startTime = Date.now();
  history.push({ role: 'assistant', content: text });

  try {
    const audioBuffer = await synthesizeSpeech(text);
    if (!audioBuffer) return;
    const base64Audio = audioBuffer.toString('base64');

    ws.send(JSON.stringify({
      event: 'media',
      media: { payload: base64Audio },
    }));
    
    logger.info('[Voice AI] AI response sent', { callId, duration_ms: Date.now() - startTime });
  } catch (error: unknown) {
    logger.error('[Voice AI] Error sending AI response', error, { callId });
  }
}
