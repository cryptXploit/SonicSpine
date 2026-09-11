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
    const filter = new TemporalFilter(1.0, 1.5, 3.0, 1.5); // drift=1.5s
    
    // Good posture (0 deviation)
    let res = filter.process(createFeatures(0, 0, 0.5, 0.8), baseline, 0);
    expect(res.stateFlags.isDrifting).toBe(false);

    // Bad posture: 11 degrees of tilt (110 penalty) -> out of bounds but not sustained yet
    res = filter.process(createFeatures(11, 0, 0.5, 0.8), baseline, 100);
    expect(res.stateFlags.isDrifting).toBe(false);
  });

  it('detects sustained deviation (debounce)', () => {
    const filter = new TemporalFilter(1.0, 1.5, 3.0, 1.5); // 1.5s to drift, 3s to correct
    
    // Out of bounds (10 tilt = 100 penalty) at 0ms
    let res = filter.process(createFeatures(10, 0, 0.5, 0.8), baseline, 0);
    expect(res.stateFlags.isDrifting).toBe(false);
    expect(res.stateFlags.isCorrective).toBe(false);

    // Still out of bounds at 1500ms
    res = filter.process(createFeatures(10, 0, 0.5, 0.8), baseline, 1500);
    expect(res.stateFlags.isDrifting).toBe(true);
    expect(res.stateFlags.isCorrective).toBe(false);

    // Sustained out of bounds at 3000ms
    res = filter.process(createFeatures(10, 0, 0.5, 0.8), baseline, 3000);
    expect(res.stateFlags.isCorrective).toBe(true);
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
