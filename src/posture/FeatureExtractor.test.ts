import { describe, it, expect } from 'vitest';
import { FeatureExtractor } from './FeatureExtractor';
import { PostureLandmarks } from '../vision/types';

describe('FeatureExtractor', () => {
  const createMockLandmarks = (overrides: Partial<PostureLandmarks> = {}): PostureLandmarks => {
    return {
      nose: { x: 0.5, y: 0.3, z: -0.5, visibility: 0.99, presence: 0.99 },
      leftEar: { x: 0.6, y: 0.3, z: -0.2, visibility: 0.99, presence: 0.99 }, // 0.6 x, 0.3 y
      rightEar: { x: 0.4, y: 0.3, z: -0.2, visibility: 0.99, presence: 0.99 }, // 0.4 x, 0.3 y
      leftShoulder: { x: 0.7, y: 0.5, z: 0, visibility: 0.99, presence: 0.99 }, // 0.7 x, 0.5 y
      rightShoulder: { x: 0.3, y: 0.5, z: 0, visibility: 0.99, presence: 0.99 }, // 0.3 x, 0.5 y
      ...overrides
    };
  };

  it('calculates 0 tilt and roll when perfectly horizontal', () => {
    const landmarks = createMockLandmarks();
    const features = FeatureExtractor.extract(landmarks);
    
    // headDx = 0.6 - 0.4 = 0.2
    // headDy = 0.3 - 0.3 = 0
    // headSize = 0.2
    
    // shoulderDx = 0.7 - 0.3 = 0.4
    // shoulderDy = 0.5 - 0.5 = 0
    // shoulderWidth = 0.4
    
    // forwardCraneRatio = 0.2 / 0.4 = 0.5
    
    // neckCollapseRatio
    // shoulderMidY = 0.5
    // noseY = 0.3
    // neckCollapseRatio = (0.5 - 0.3) / 0.4 = 0.5
    
    expect(features.headTilt).toBeCloseTo(0);
    expect(features.shoulderRoll).toBeCloseTo(0);
    expect(features.forwardCraneRatio).toBeCloseTo(0.5);
    expect(features.neckCollapseRatio).toBeCloseTo(0.5);
  });
});
