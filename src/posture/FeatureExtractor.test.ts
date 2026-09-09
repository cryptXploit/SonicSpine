import { describe, it, expect } from 'vitest';
import { FeatureExtractor } from './FeatureExtractor';
import { PostureLandmarks, Point3D } from '../vision/types';

describe('FeatureExtractor', () => {
  const createPoint = (x: number, y: number, z: number = 0): Point3D => ({
    x, y, z, visibility: 1, presence: 1
  });

  it('calculates 0 tilt and roll when perfectly horizontal', () => {
    const landmarks: PostureLandmarks = {
      nose: createPoint(0.5, 0.5),
      rightEar: createPoint(0.4, 0.4),
      leftEar: createPoint(0.6, 0.4),
      rightShoulder: createPoint(0.3, 0.7),
      leftShoulder: createPoint(0.7, 0.7),
    };

    const features = FeatureExtractor.extract(landmarks);
    
    expect(features.headTilt).toBeCloseTo(0);
    expect(features.shoulderRoll).toBeCloseTo(0);
    expect(features.shoulderWidth).toBeCloseTo(0.4);
    expect(features.neckForwardDepth).toBeCloseTo(0);
  });

  it('calculates positive tilt when left side is lower (higher Y)', () => {
    const landmarks: PostureLandmarks = {
      nose: createPoint(0.5, 0.5),
      rightEar: createPoint(0.4, 0.4),
      leftEar: createPoint(0.6, 0.6), // lower down on the screen
      rightShoulder: createPoint(0.3, 0.7),
      leftShoulder: createPoint(0.7, 0.9), // lower down
    };

    const features = FeatureExtractor.extract(landmarks);
    
    // dx = 0.2, dy = 0.2 => atan2(0.2, 0.2) = 45 degrees
    expect(features.headTilt).toBeCloseTo(45);
    // dx = 0.4, dy = 0.2 => atan2(0.2, 0.4) = ~26.565 degrees
    expect(features.shoulderRoll).toBeCloseTo(26.565);
  });

  it('calculates negative tilt when right side is lower (higher Y)', () => {
    const landmarks: PostureLandmarks = {
      nose: createPoint(0.5, 0.5),
      rightEar: createPoint(0.4, 0.6), // lower down
      leftEar: createPoint(0.6, 0.4),
      rightShoulder: createPoint(0.3, 0.9), // lower down
      leftShoulder: createPoint(0.7, 0.7),
    };

    const features = FeatureExtractor.extract(landmarks);
    
    // dx = 0.2, dy = -0.2 => atan2(-0.2, 0.2) = -45 degrees
    expect(features.headTilt).toBeCloseTo(-45);
  });

  it('calculates depth differences accurately', () => {
    const landmarks: PostureLandmarks = {
      nose: createPoint(0.5, 0.5, -0.5),
      rightEar: createPoint(0.4, 0.4, -0.8), // closer to camera
      leftEar: createPoint(0.6, 0.4, -0.8),
      rightShoulder: createPoint(0.3, 0.7, -0.1), // further back
      leftShoulder: createPoint(0.7, 0.7, -0.1),
    };

    const features = FeatureExtractor.extract(landmarks);
    
    // avgEarZ = -0.8
    // avgShoulderZ = -0.1
    // neckForwardDepth = -0.8 - (-0.1) = -0.7
    expect(features.neckForwardDepth).toBeCloseTo(-0.7);
  });
});
