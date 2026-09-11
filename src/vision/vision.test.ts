import { describe, it, expect } from 'vitest';
import { LandmarkProcessor } from './LandmarkProcessor';
import { ConfidenceEstimator } from './ConfidenceEstimator';
import { PostureLandmarks } from './types';

describe('Vision Pipeline', () => {
  describe('LandmarkProcessor', () => {
    it('returns null if no pose is detected', () => {
      const emptyResult = { landmarks: [] };
      expect(LandmarkProcessor.process(emptyResult as any)).toBeNull();
    });

    it('extracts required landmarks correctly', () => {
      // Mock MediaPipe result
      const mockResult = {
        landmarks: [[
          { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }, // 0: nose
          {}, {}, {}, {}, {}, {}, // 1-6
          { x: 0.4, y: 0.4, z: 0.2, visibility: 0.8 }, // 7: left ear
          { x: 0.6, y: 0.4, z: 0.2, visibility: 0.8 }, // 8: right ear
          {}, {}, // 9-10
          { x: 0.3, y: 0.7, z: 0.3, visibility: 0.9 }, // 11: left shoulder
          { x: 0.7, y: 0.7, z: 0.3, visibility: 0.9 }, // 12: right shoulder
        ]]
      };

      const result = LandmarkProcessor.process(mockResult as any);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.nose.x).toBe(0.5);
        expect(result.leftEar.x).toBe(0.4);
        expect(result.rightShoulder.visibility).toBe(0.9);
      }
    });
  });

  describe('ConfidenceEstimator', () => {
    it('returns NONE when landmarks are null', () => {
      expect(ConfidenceEstimator.evaluate(null)).toEqual({ level: 'NONE', score: 0 });
    });

    it('returns HIGH when core landmarks are visible', () => {
      const mockLandmarks: PostureLandmarks = {
        leftEar: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        rightEar: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        leftShoulder: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        rightShoulder: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        nose: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 }
      };

      expect(ConfidenceEstimator.evaluate(mockLandmarks)).toEqual({ level: 'HIGH', score: 0.9 });
    });

    it('returns LOW when core landmarks have poor visibility', () => {
      const mockLandmarks: PostureLandmarks = {
        leftEar: { x: 0, y: 0, z: 0, visibility: 0.1, presence: 0.1 },
        rightEar: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        leftShoulder: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        rightShoulder: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        nose: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 }
      };

      // 3 landmarks > 0.5 threshold = score of avgVisibility * 0.5
      // Avg visibility = (0.1+0.9+0.9+0.9)/4 = 0.7
      // Score = 0.7 * 0.5 = 0.35
      expect(ConfidenceEstimator.evaluate(mockLandmarks).level).toBe('LOW');
      expect(ConfidenceEstimator.evaluate(mockLandmarks).score).toBeCloseTo(0.35);
    });
  });
});
