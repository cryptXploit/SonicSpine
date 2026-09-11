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
    const filter = new TemporalFilter(0.2);
    expect(filter).toBeDefined();
  });

  it('smooths features properly', () => {
    const filter = new TemporalFilter(0.5);

    const f1 = createFeatures(10, 5, 0.5, 0.8);
    let res = filter.process(f1, baseline, 0);

    const f2 = createFeatures(20, 15, 0.6, 0.7);
    res = filter.process(f2, baseline, 100); // Trigger smoothing

    // We can't strictly assert the exact value due to dynamic motion smoothing,
    // but we can assert it moved towards f2
    expect(res.smoothed.headTilt).toBeGreaterThan(10);
    expect(res.smoothed.headTilt).toBeLessThan(20);
  });

  it('detects sustained deviation (evidence accumulation)', () => {
    const filter = new TemporalFilter(1.0); 
    
    // Out of bounds (15 tilt = 150 penalty)
    let res = filter.process(createFeatures(15, 0, 0.5, 0.8), baseline, 0);
    expect(res.stateFlags.isDrifting).toBe(false);
    expect(res.stateFlags.isCorrective).toBe(false);

    let frame = 1;
    // Simulate until drifting
    while(!res.stateFlags.isDrifting && frame < 300) {
        res = filter.process(createFeatures(15, 0, 0.5, 0.8), baseline, frame * 16.6);
        frame++;
    }
    expect(res.stateFlags.isDrifting).toBe(true);
    expect(res.stateFlags.isCorrective).toBe(false);

    // Simulate until corrective
    while(!res.stateFlags.isCorrective && frame < 600) {
        res = filter.process(createFeatures(15, 0, 0.5, 0.8), baseline, frame * 16.6);
        frame++;
    }
    expect(res.stateFlags.isCorrective).toBe(true);
  });

  it('resets correctly', () => {
    const filter = new TemporalFilter(0.2);
    filter.process(createFeatures(20, 0, 0.5, 0.8), baseline, 0);
    filter.reset();
    
    // A fresh call should be smoothed from scratch
    const res = filter.process(createFeatures(0, 0, 0.5, 0.8), baseline, 100);
    expect(res.smoothed.headTilt).toBe(0);
  });
});
