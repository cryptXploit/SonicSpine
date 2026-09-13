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

    it('extracts genuine hand landmarks safely (Test 9, 10, 11)', () => {
      const mockResult = {
        pose: {
          landmarks: [[
            { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }, { }, { }, { }, { }, { }, { },
            { x: 0.4, y: 0.4, z: 0.2, visibility: 0.8 }, { x: 0.6, y: 0.4, z: 0.2, visibility: 0.8 }, { }, { },
            { x: 0.3, y: 0.7, z: 0.3, visibility: 0.9 }, { x: 0.7, y: 0.7, z: 0.3, visibility: 0.9 }
          ]]
        },
        hands: {
          handednesses: [[{ categoryName: 'Right' }]], // Test 9
          landmarks: [[
            { x: 0, y: 0, z: 0 }, // 0: Wrist
            {}, {}, {},
            { x: 0.1, y: 0.1, z: 0 }, // 4: Thumb tip
            { x: 0.2, y: 0.2, z: 0 }, // 5: Index MCP
            {}, {},
            { x: 0.3, y: 0.3, z: 0 }, // 8: Index tip
            { x: 0.2, y: 0.2, z: 0 }, // 9: Middle MCP
            {}, {},
            { x: 0.3, y: 0.3, z: 0 }, // 12: Middle tip
            { x: 0.2, y: 0.2, z: 0 }, // 13: Ring MCP
            {}, {},
            { x: 0.3, y: 0.3, z: 0 }, // 16: Ring tip
            { x: 0.4, y: 0.2, z: 0 }, // 17: Pinky MCP
            {}, {},
            { x: 0.3, y: 0.3, z: 0 }  // 20: Pinky tip
          ]]
        }
      };

      const result = LandmarkProcessor.process(mockResult as any);
      expect(result?.rightThumb?.x).toBe(0.1);
      expect(result?.rightIndex?.x).toBe(0.3);
      // Index MCP (0.2, 0.2), Pinky MCP (0.4, 0.2) => dx=0.2, dy=0 => scale=0.2
      expect(result?.rightHandScale).toBeCloseTo(0.2, 5);

      // Test 10: Missing handedness shouldn't crash and should fallback to Left
      mockResult.hands.handednesses = [];
      const result2 = LandmarkProcessor.process(mockResult as any);
      expect(result2?.leftThumb?.x).toBe(0.1);

      // Missing thumb/index should skip safely
      mockResult.hands.landmarks[0][4] = {} as any; // Invalid x, y
      const result3 = LandmarkProcessor.process(mockResult as any);
      expect(result3?.leftThumb).toBeUndefined();
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
