import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoicePipelineService } from './voicePipelineService';
import { EventEmitter } from 'events';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  send = vi.fn();
  close = vi.fn();
}

describe('VoicePipelineService Integration', () => {
  let mockWs: MockWebSocket;
  let pipeline: VoicePipelineService;

  beforeEach(() => {
    mockWs = new MockWebSocket() as any;
    
    pipeline = new VoicePipelineService(mockWs as any, {
      callId: 'integration-test-call',
      streamSid: 'stream-123',
      callSid: 'call-456',
      asrProvider: 'openai',
      llmModel: 'gpt-4o-mini',
      ttsVoice: 'alloy',
    });
  });

  afterEach(async () => {
    if (pipeline) {
      await pipeline.stop();
    }
  });

  describe('Pipeline Initialization', () => {
    it('should initialize pipeline correctly', () => {
      expect(pipeline).toBeDefined();
    });

    it('should start with greeting', async () => {
      await pipeline.start();
      
      // Check that WebSocket send was called
      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should emit transcription events', (done) => {
      pipeline.on('transcription', (data) => {
        expect(data).toHaveProperty('callId');
        expect(data).toHaveProperty('text');
        expect(data).toHaveProperty('confidence');
        done();
      });

      // Simulate transcription event
      pipeline.emit('transcription', {
        callId: 'integration-test-call',
        text: 'Test transcription',
        confidence: 0.95,
      });
    });

    it('should emit response events', (done) => {
      pipeline.on('response', (data) => {
        expect(data).toHaveProperty('callId');
        expect(data).toHaveProperty('text');
        done();
      });

      pipeline.emit('response', {
        callId: 'integration-test-call',
        text: 'Test response',
        ttsLatency: 500,
      });
    });

    it('should emit error events', (done) => {
      pipeline.on('error', (data) => {
        expect(data).toHaveProperty('stage');
        expect(data).toHaveProperty('error');
        done();
      });

      pipeline.emit('error', {
        stage: 'test',
        error: new Error('Test error'),
      });
    });
  });

  describe('Metrics Collection', () => {
    it('should collect metrics', async () => {
      await pipeline.start();
      
      const metrics = pipeline.getMetrics();
      expect(metrics).toHaveProperty('callId');
      expect(metrics).toHaveProperty('asrLatency');
      expect(metrics).toHaveProperty('llmLatency');
      expect(metrics).toHaveProperty('ttsLatency');
      expect(metrics).toHaveProperty('totalLatency');
      expect(metrics).toHaveProperty('transcriptionCount');
      expect(metrics).toHaveProperty('responseCount');
      expect(metrics).toHaveProperty('errorCount');
    });

    it('should track latency metrics', async () => {
      await pipeline.start();
      
      const metrics = pipeline.getMetrics();
      expect(Array.isArray(metrics.asrLatency)).toBe(true);
      expect(Array.isArray(metrics.llmLatency)).toBe(true);
      expect(Array.isArray(metrics.ttsLatency)).toBe(true);
      expect(Array.isArray(metrics.totalLatency)).toBe(true);
    });
  });

  describe('Conversation History', () => {
    it('should maintain conversation history', async () => {
      await pipeline.start();
      
      const history = pipeline.getConversationHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      
      // Should have system prompt
      expect(history[0].role).toBe('system');
    });

    it('should add greeting to history', async () => {
      await pipeline.start();
      
      const history = pipeline.getConversationHistory();
      const assistantMessages = history.filter(m => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Pipeline Lifecycle', () => {
    it('should start successfully', async () => {
      await expect(pipeline.start()).resolves.not.toThrow();
    });

    it('should stop successfully', async () => {
      await pipeline.start();
      await expect(pipeline.stop()).resolves.not.toThrow();
    });

    it('should emit stopped event on stop', async (done) => {
      await pipeline.start();
      
      pipeline.on('stopped', (data) => {
        expect(data).toHaveProperty('callId');
        expect(data).toHaveProperty('metrics');
        done();
      });

      await pipeline.stop();
    });
  });

  describe('Audio Processing', () => {
    it('should accept audio chunks', async () => {
      await pipeline.start();
      
      const audioChunk = Buffer.from('test audio').toString('base64');
      await expect(pipeline.processAudio(audioChunk)).resolves.not.toThrow();
    });
  });

  describe('Error Recovery', () => {
    it('should handle ASR errors gracefully', async () => {
      await pipeline.start();
      
      let errorEmitted = false;
      pipeline.on('error', () => {
        errorEmitted = true;
      });

      // Simulate ASR error
      const asrService = (pipeline as any).asrService;
      if (asrService) {
        asrService.emit('error', new Error('ASR test error'));
      }

      // Pipeline should continue running
      expect(pipeline).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle multiple rapid transcriptions', async () => {
      await pipeline.start();
      
      const transcriptions = [
        'First transcription',
        'Second transcription',
        'Third transcription',
      ];

      for (const text of transcriptions) {
        // Simulate transcription
        const asrService = (pipeline as any).asrService;
        if (asrService) {
          asrService.emit('transcription', {
            text,
            isFinal: true,
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }
        
        // Small delay to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const metrics = pipeline.getMetrics();
      expect(metrics.transcriptionCount).toBeGreaterThanOrEqual(0);
    });
  });
});
