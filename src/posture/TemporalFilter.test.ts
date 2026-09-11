import { describe, it, expect } from 'vitest';
import { TemporalFilter } from './TemporalFilter';
import { PostureFeatures } from './types';
import { PostureBaseline } from './CalibrationEngine';

describe('TemporalFilter', () => {
  const createFeatures = (tilt: number, roll: number, crane: number, collapse: number): PostureFeatures => ({
    headTilt: tilt,
    shoulderRoll: roll,
    forwardCraneRatio: crane,
    neckCollapseRatio: collapse,
    noseYawDeviation: 0
  });

  const baseline: PostureBaseline = {
    features: createFeatures(0, 0, 0.5, 0.8),
    timestamp: 0
  };

  it('initializes correctly', () => {
    const filter = new TemporalFilter(0.2, 3.0, 1.5);
    expect(filter).toBeDefined();
  });

  it('detects out of bounds instantly based on penalty score', () => {
    const filter = new TemporalFilter(1.0, 3.0, 1.5); // no smoothing
    
    // Good posture (0 deviation)
    let res = filter.process(createFeatures(0, 0, 0.5, 0.8), baseline, 0);
    expect(res.isInstantlyOutOfBounds).toBe(false);

    // Bad posture: 11 degrees of tilt (110 penalty, > 100 threshold)
    res = filter.process(createFeatures(11, 0, 0.5, 0.8), baseline, 100);
    expect(res.isInstantlyOutOfBounds).toBe(true);
  });

  it('detects sustained deviation (debounce)', () => {
    const filter = new TemporalFilter(1.0, 3.0, 1.5); // 3 seconds to drift
    
    // Out of bounds (15 tilt = 150 penalty) at 0ms
    let res = filter.process(createFeatures(15, 0, 0.5, 0.8), baseline, 0);
    expect(res.isInstantlyOutOfBounds).toBe(true);
    expect(res.isSustainedDeviation).toBe(false);

    // Still out of bounds at 2000ms
    res = filter.process(createFeatures(15, 0, 0.5, 0.8), baseline, 2000);
    expect(res.isSustainedDeviation).toBe(false);

    // Sustained out of bounds at 3000ms
    res = filter.process(createFeatures(15, 0, 0.5, 0.8), baseline, 3000);
    expect(res.isSustainedDeviation).toBe(true);
  });

  it('resets correctly', () => {
    const filter = new TemporalFilter(0.2, 3.0, 1.5);
    filter.process(createFeatures(20, 0, 0.5, 0.8), baseline, 0);
    filter.reset();
    
    // A fresh call should be smoothed from scratch
    const res = filter.process(createFeatures(0, 0, 0.5, 0.8), baseline, 100);
    expect(res.smoothed.headTilt).toBe(0);
  });
});
