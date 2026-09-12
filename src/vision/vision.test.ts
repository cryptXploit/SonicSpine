import { describe, it, expect } from 'vitest';
import { LandmarkProcessor } from './LandmarkProcessor';
import { ConfidenceEstimator } from './ConfidenceEstimator';
import { PostureLandmarks } from './types';

describe('Vision Pipeline', () => {
  describe('LandmarkProcessor', () => {
    it('returns null if no pose is detected', () => {
      const emptyResult = { pose: { landmarks: [] }, hands: null };
      expect(LandmarkProcessor.process(emptyResult as any)).toBeNull();
    });

    it('extracts required landmarks correctly', () => {
      // Mock MediaPipe result
      const mockResult = {
        pose: {
          landmarks: [[
            { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }, // 0: nose
            {}, {}, {}, {}, {}, {}, // 1-6
            { x: 0.4, y: 0.4, z: 0.2, visibility: 0.8 }, // 7: left ear
            { x: 0.6, y: 0.4, z: 0.2, visibility: 0.8 }, // 8: right ear
            {}, {}, // 9-10
            { x: 0.3, y: 0.7, z: 0.3, visibility: 0.9 }, // 11: left shoulder
            { x: 0.7, y: 0.7, z: 0.3, visibility: 0.9 }, // 12: right shoulder
          ]]
        },
        hands: null
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
      expect(ConfidenceEstimator.evaluate(null)).toEqual({ 
        level: 'NONE', 
        score: 0,
        details: { headVisible: false, shouldersVisible: false }
      });
    });

    it('returns HIGH when core landmarks are visible', () => {
      const mockLandmarks: PostureLandmarks = {
        leftEar: { x: 0, y: 0, z: 0, visibility: 0.9 },
        rightEar: { x: 0, y: 0, z: 0, visibility: 0.9 },
        leftShoulder: { x: 0, y: 0, z: 0, visibility: 0.9 },
        rightShoulder: { x: 0, y: 0, z: 0, visibility: 0.9 }
      } as PostureLandmarks;

      expect(ConfidenceEstimator.evaluate(mockLandmarks)).toEqual({ 
        level: 'HIGH', 
        score: 0.9,
        details: { headVisible: true, shouldersVisible: true }
      });
    });

    it('returns LOW when core landmarks have poor visibility', () => {
      const mockLandmarks: PostureLandmarks = {
        leftEar: { x: 0, y: 0, z: 0, visibility: 0.1 }, // Hidden
        rightEar: { x: 0, y: 0, z: 0, visibility: 0.1 }, // Hidden
        leftShoulder: { x: 0, y: 0, z: 0, visibility: 0.9 },
        rightShoulder: { x: 0, y: 0, z: 0, visibility: 0.9 }
      } as PostureLandmarks;

      // Score logic fallback to LOW
      expect(ConfidenceEstimator.evaluate(mockLandmarks).level).toBe('LOW');
      expect(ConfidenceEstimator.evaluate(mockLandmarks).details.headVisible).toBe(false);
    });
  });
});
