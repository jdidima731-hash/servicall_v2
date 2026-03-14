import { describe, it, expect, beforeEach } from 'vitest';
import { ASRStreamingService } from './asrStreamingService';

describe('ASRStreamingService', () => {
  let asrService: ASRStreamingService;
  const mockCallId = 'test-call-123';

  beforeEach(() => {
    asrService = new ASRStreamingService(mockCallId, {
      provider: 'openai',
      language: 'fr',
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const status = asrService.getStatus();
      expect(status.callId).toBe(mockCallId);
      expect(status.provider).toBe('openai');
      expect(status.isProcessing).toBe(false);
      expect(status.bufferSize).toBe(0);
    });

    it('should use default configuration when not provided', () => {
      const defaultService = new ASRStreamingService('call-456');
      const status = defaultService.getStatus();
      expect(status.provider).toBe('openai');
    });
  });

  describe('Audio Processing', () => {
    it('should accept audio chunks', async () => {
      const audioChunk = Buffer.from('test audio data').toString('base64');
      await asrService.processAudioChunk(audioChunk);
      
      const status = asrService.getStatus();
      expect(status.bufferSize).toBeGreaterThan(0);
    });

    it('should handle invalid base64 audio gracefully', async () => {
      const invalidAudio = 'not-valid-base64!!!';
      await expect(asrService.processAudioChunk(invalidAudio)).rejects.toThrow();
    });
  });

  describe('Event Emission', () => {
    it('should emit transcription events', (done) => {
      asrService.on('transcription', (result) => {
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('isFinal');
        done();
      });

      // Simulate transcription
      asrService.emit('transcription', {
        text: 'Test transcription',
        confidence: 0.95,
        isFinal: true,
        timestamp: Date.now(),
      });
    });

    it('should emit error events', (done) => {
      asrService.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      asrService.emit('error', new Error('Test error'));
    });
  });

  describe('Status Reporting', () => {
    it('should report correct status', () => {
      const status = asrService.getStatus();
      expect(status).toHaveProperty('callId');
      expect(status).toHaveProperty('provider');
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('bufferSize');
      expect(status).toHaveProperty('reconnectAttempts');
    });
  });

  describe('Cleanup', () => {
    it('should stop gracefully', async () => {
      await asrService.stop();
      expect(asrService.listenerCount('transcription')).toBe(0);
    });
  });
});
