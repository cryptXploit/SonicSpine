import { describe, it, expect } from 'vitest';
import { LandmarkProcessor } from './LandmarkProcessor';
import { ConfidenceEstimator } from './ConfidenceEstimator';
import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { PostureLandmarks } from './types';

describe('Vision Pipeline', () => {
  describe('LandmarkProcessor', () => {
    it('returns null when result is null', () => {
      expect(LandmarkProcessor.process(null)).toBeNull();
    });

    it('returns null when no landmarks are detected', () => {
      const mockResult = { landmarks: [] } as unknown as PoseLandmarkerResult;
      expect(LandmarkProcessor.process(mockResult)).toBeNull();
    });

    it('maps MediaPipe landmarks to PostureLandmarks', () => {
      // Mock 33 landmarks
      const mockLandmarks = Array(33).fill(null).map((_, i) => ({
        x: i * 0.1, y: i * 0.1, z: i * 0.1, visibility: 0.9, presence: 0.9
      }));

      const mockResult = { landmarks: [mockLandmarks] } as unknown as PoseLandmarkerResult;
      
      const processed = LandmarkProcessor.process(mockResult);
      expect(processed).not.toBeNull();
      
      if (processed) {
        expect(processed.nose.x).toBe(0.0);
        expect(processed.leftEar.x).toBe(0.7000000000000001); // 7 * 0.1
        expect(processed.rightEar.x).toBe(0.8);
        expect(processed.leftShoulder.x).toBe(1.1);
        expect(processed.rightShoulder.x).toBe(1.2000000000000002);
      }
    });
  });

  describe('ConfidenceEstimator', () => {
    it('returns NONE when landmarks are null', () => {
      expect(ConfidenceEstimator.evaluate(null)).toBe('NONE');
    });

    it('returns HIGH when core landmarks are visible', () => {
      const mockLandmarks: PostureLandmarks = {
        nose: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        leftEar: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        rightEar: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        leftShoulder: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        rightShoulder: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
      };

      expect(ConfidenceEstimator.evaluate(mockLandmarks)).toBe('HIGH');
    });

    it('returns LOW when core landmarks have poor visibility', () => {
      const mockLandmarks: PostureLandmarks = {
        nose: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        leftEar: { x: 0, y: 0, z: 0, visibility: 0.3, presence: 0.9 }, // Low visibility
        rightEar: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        leftShoulder: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
        rightShoulder: { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.9 },
      };

      expect(ConfidenceEstimator.evaluate(mockLandmarks)).toBe('LOW');
    });
  });
});
