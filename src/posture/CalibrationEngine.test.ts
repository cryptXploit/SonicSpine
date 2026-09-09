import { describe, it, expect } from 'vitest';
import { CalibrationEngine } from './CalibrationEngine';
import { PostureFeatures } from './types';

describe('CalibrationEngine', () => {
  const createSample = (tilt: number, roll: number, crane: number, collapse: number): PostureFeatures => ({
    headTilt: tilt,
    shoulderRoll: roll,
    forwardCraneRatio: crane,
    neckCollapseRatio: collapse
  });

  it('initializes with 0 progress', () => {
    const engine = new CalibrationEngine(5);
    expect(engine.getProgress()).toBe(0);
  });

  it('returns null if not enough samples', () => {
    const engine = new CalibrationEngine(3);
    engine.addSample(createSample(0, 0, 0.5, 0.8));
    engine.addSample(createSample(1, 1, 0.51, 0.79));
    
    expect(engine.getProgress()).toBeCloseTo(2/3);
    expect(engine.calibrate()).toBeNull();
  });

  it('calculates averages correctly', () => {
    const engine = new CalibrationEngine(3, 300); // high variance threshold
    engine.addSample(createSample(0, 0, 0.5, 0.8));
    engine.addSample(createSample(2, 4, 0.6, 0.9));
    engine.addSample(createSample(-2, -4, 0.4, 0.7));
    
    expect(engine.getProgress()).toBe(1.0);
    const baseline = engine.calibrate();
    
    expect(baseline).not.toBeNull();
    expect(baseline!.features.headTilt).toBeCloseTo(0);
    expect(baseline!.features.shoulderRoll).toBeCloseTo(0);
    expect(baseline!.features.forwardCraneRatio).toBeCloseTo(0.5);
    expect(baseline!.features.neckCollapseRatio).toBeCloseTo(0.8);
    expect(baseline!.timestamp).toBeGreaterThan(0);
  });

  it('throws an error and resets if variance is too high', () => {
    const engine = new CalibrationEngine(3, 5.0); // max variance 5
    
    // Create highly variable samples
    engine.addSample(createSample(0, 0, 0.5, 0.8));
    engine.addSample(createSample(20, 10, 0.6, 0.9));
    engine.addSample(createSample(-20, -10, 0.4, 0.7));

    expect(() => engine.calibrate()).toThrow('Calibration unstable');
    expect(engine.getProgress()).toBe(0); // Should reset automatically
  });
});
