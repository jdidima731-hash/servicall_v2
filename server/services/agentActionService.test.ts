import { describe, it, expect } from 'vitest';
import { processAgentActions, ToolCall, getAvailableActions } from './agentActionService';

describe('AgentActionService', () => {
  const mockContext = {
    callId: 'test-call-123',
    callSid: 'CA123456',
    userId: 'user-123',
  };

  describe('Action Processing', () => {
    it('should process valid tool calls', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-1',
          type: 'function',
          function: {
            name: 'bookAppointment',
            arguments: JSON.stringify({
              date: '2026-02-15',
              time: '14:00',
              reason: 'Consultation',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);

      expect(results).toHaveLength(1);
      expect(results[0].tool_call_id).toBe('call-1');
      expect(results[0].role).toBe('tool');
      expect(results[0].name).toBe('bookAppointment');

      const content = JSON.parse(results[0].content);
      expect(content.success).toBe(true);
      expect(content.data).toHaveProperty('appointmentId');
    });

    it('should handle invalid JSON arguments', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-2',
          type: 'function',
          function: {
            name: 'bookAppointment',
            arguments: 'invalid-json{',
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);

      expect(results).toHaveLength(1);
      const content = JSON.parse(results[0].content);
      expect(content.success).toBe(false);
      expect(content.error).toContain('JSON invalides');
    });

    it('should handle unknown function names', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-3',
          type: 'function',
          function: {
            name: 'unknownFunction',
            arguments: JSON.stringify({}),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);

      expect(results).toHaveLength(1);
      const content = JSON.parse(results[0].content);
      expect(content.success).toBe(false);
      expect(content.error).toContain('inconnue');
    });
  });

  describe('Argument Validation', () => {
    it('should validate appointment date format', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-4',
          type: 'function',
          function: {
            name: 'bookAppointment',
            arguments: JSON.stringify({
              date: 'invalid-date',
              time: '14:00',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);
      const content = JSON.parse(results[0].content);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Date invalide');
    });

    it('should validate phone number format', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-5',
          type: 'function',
          function: {
            name: 'sendSMSConfirmation',
            arguments: JSON.stringify({
              phoneNumber: 'invalid',
              message: 'Test message',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);
      const content = JSON.parse(results[0].content);
      expect(content.success).toBe(false);
      expect(content.error).toContain('téléphone invalide');
    });

    it('should validate email format', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-6',
          type: 'function',
          function: {
            name: 'sendEmail',
            arguments: JSON.stringify({
              to: 'invalid-email',
              subject: 'Test',
              body: 'Test body',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);
      const content = JSON.parse(results[0].content);
      expect(content.success).toBe(false);
      expect(content.error).toContain('email invalide');
    });
  });

  describe('Multiple Actions', () => {
    it('should process multiple tool calls', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-7',
          type: 'function',
          function: {
            name: 'bookAppointment',
            arguments: JSON.stringify({
              date: '2026-03-01',
              time: '10:00',
            }),
          },
        },
        {
          id: 'call-8',
          type: 'function',
          function: {
            name: 'createTicket',
            arguments: JSON.stringify({
              subject: 'Test ticket',
              description: 'Test description',
              priority: 'medium',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('bookAppointment');
      expect(results[1].name).toBe('createTicket');
    });
  });

  describe('Action Handlers', () => {
    it('should handle bookAppointment', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-9',
          type: 'function',
          function: {
            name: 'bookAppointment',
            arguments: JSON.stringify({
              date: '2026-04-01',
              time: '15:30',
              reason: 'Follow-up',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);
      const content = JSON.parse(results[0].content);

      expect(content.success).toBe(true);
      expect(content.data.date).toBe('2026-04-01');
      expect(content.data.time).toBe('15:30');
    });

    it('should handle transferToHumanAgent', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-10',
          type: 'function',
          function: {
            name: 'transferToHumanAgent',
            arguments: JSON.stringify({
              reason: 'Complex issue',
              priority: 'high',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);
      const content = JSON.parse(results[0].content);

      expect(content.success).toBe(true);
      expect(content.data.status).toBe('transfer_initiated');
    });

    it('should handle createTicket', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-11',
          type: 'function',
          function: {
            name: 'createTicket',
            arguments: JSON.stringify({
              subject: 'Bug report',
              description: 'System not responding',
              priority: 'urgent',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);
      const content = JSON.parse(results[0].content);

      expect(content.success).toBe(true);
      expect(content.data).toHaveProperty('ticketId');
      expect(content.data.priority).toBe('urgent');
    });
  });

  describe('Available Actions', () => {
    it('should return list of available actions', () => {
      const actions = getAvailableActions();

      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions).toContain('bookAppointment');
      expect(actions).toContain('sendSMSConfirmation');
      expect(actions).toContain('transferToHumanAgent');
    });
  });

  describe('Error Handling', () => {
    it('should handle past appointment dates', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-12',
          type: 'function',
          function: {
            name: 'bookAppointment',
            arguments: JSON.stringify({
              date: '2020-01-01',
              time: '10:00',
            }),
          },
        },
      ];

      const results = await processAgentActions(toolCalls, mockContext);
      const content = JSON.parse(results[0].content);

      expect(content.success).toBe(false);
      expect(content.error).toContain('passé');
    });
  });
});
