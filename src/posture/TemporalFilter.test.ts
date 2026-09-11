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
    const filter = new TemporalFilter(0.2, 3.0, 1.5);
    filter.process(createFeatures(20, 0, 0.5, 0.8), baseline, 0);
    filter.reset();
    
    // A fresh call should be smoothed from scratch
    const res = filter.process(createFeatures(0, 0, 0.5, 0.8), baseline, 100);
    expect(res.smoothed.headTilt).toBe(0);
  });
});
