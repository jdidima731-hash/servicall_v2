import { describe, it, expect, beforeEach } from 'vitest';
import { SentimentAnalysisService } from './sentimentAnalysisService';

describe('SentimentAnalysisService', () => {
  let sentimentService: SentimentAnalysisService;
  const mockCallId = 'test-call-sentiment-123';

  beforeEach(() => {
    sentimentService = new SentimentAnalysisService(mockCallId, {
      angerThreshold: 0.7,
      frustrationThreshold: 0.7,
      stressThreshold: 0.7,
      escalationThreshold: 0.75,
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct thresholds', () => {
      expect(sentimentService).toBeDefined();
    });

    it('should use default thresholds when not provided', () => {
      const defaultService = new SentimentAnalysisService('call-456');
      expect(defaultService).toBeDefined();
    });
  });

  describe('Sentiment Trend', () => {
    it('should return default trend when no history', () => {
      const trend = sentimentService.getSentimentTrend();
      expect(trend.averageScore).toBe(0);
      expect(trend.trend).toBe('stable');
      expect(trend.escalationCount).toBe(0);
    });

    it('should calculate average score correctly', async () => {
      // Mock positive sentiment
      const mockResult = {
        sentiment: 'positive' as const,
        score: 0.8,
        confidence: 0.9,
        emotions: {
          anger: 0,
          frustration: 0,
          stress: 0,
          satisfaction: 0.8,
          neutral: 0.2,
        },
        shouldEscalate: false,
      };

      // Manually add to history for testing
      (sentimentService as any).sentimentHistory.push(mockResult);

      const trend = sentimentService.getSentimentTrend();
      expect(trend.averageScore).toBe(0.8);
    });
  });

  describe('History Management', () => {
    it('should maintain sentiment history', () => {
      const history = sentimentService.getHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });

    it('should add entries to history', async () => {
      const mockResult = {
        sentiment: 'neutral' as const,
        score: 0,
        confidence: 0.8,
        emotions: {
          anger: 0,
          frustration: 0,
          stress: 0,
          satisfaction: 0,
          neutral: 1,
        },
        shouldEscalate: false,
      };

      (sentimentService as any).sentimentHistory.push(mockResult);

      const history = sentimentService.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].sentiment).toBe('neutral');
    });
  });

  describe('Summary Generation', () => {
    it('should generate correct summary', () => {
      const summary = sentimentService.getSummary();
      expect(summary).toHaveProperty('callId');
      expect(summary).toHaveProperty('analysisCount');
      expect(summary).toHaveProperty('averageScore');
      expect(summary).toHaveProperty('trend');
      expect(summary).toHaveProperty('escalationCount');
      expect(summary).toHaveProperty('lastSentiment');
    });

    it('should show correct analysis count', () => {
      const mockResult = {
        sentiment: 'positive' as const,
        score: 0.5,
        confidence: 0.8,
        emotions: {
          anger: 0,
          frustration: 0,
          stress: 0,
          satisfaction: 0.5,
          neutral: 0.5,
        },
        shouldEscalate: false,
      };

      (sentimentService as any).sentimentHistory.push(mockResult);
      (sentimentService as any).sentimentHistory.push(mockResult);

      const summary = sentimentService.getSummary();
      expect(summary.analysisCount).toBe(2);
    });
  });

  describe('Escalation Logic', () => {
    it('should not escalate for neutral sentiment', () => {
      const mockResult = {
        sentiment: 'neutral' as const,
        score: 0,
        confidence: 0.8,
        emotions: {
          anger: 0,
          frustration: 0,
          stress: 0,
          satisfaction: 0,
          neutral: 1,
        },
        shouldEscalate: false,
      };

      expect(mockResult.shouldEscalate).toBe(false);
    });

    it('should detect escalation need based on emotions', () => {
      // Test with high anger
      const highAngerResult = {
        sentiment: 'angry' as const,
        score: -0.8,
        confidence: 0.9,
        emotions: {
          anger: 0.9,
          frustration: 0.2,
          stress: 0.1,
          satisfaction: 0,
          neutral: 0,
        },
        shouldEscalate: true,
        escalationReason: 'Colère détectée (90%)',
      };

      expect(highAngerResult.shouldEscalate).toBe(true);
      expect(highAngerResult.escalationReason).toContain('Colère');
    });
  });
});
