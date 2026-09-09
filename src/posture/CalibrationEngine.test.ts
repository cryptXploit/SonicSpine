import { describe, it, expect, beforeEach } from 'vitest';
import { CalibrationEngine } from './CalibrationEngine';
import { PostureFeatures } from './types';

describe('CalibrationEngine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const createSample = (tilt: number, roll: number, depth: number, width: number): PostureFeatures => ({
    headTilt: tilt,
    shoulderRoll: roll,
    neckForwardDepth: depth,
    shoulderWidth: width
  });

  it('calculates progress correctly', () => {
    const engine = new CalibrationEngine(10, 10.0);
    expect(engine.getProgress()).toBe(0);
    
    engine.addSample(createSample(0, 0, 0, 0));
    engine.addSample(createSample(0, 0, 0, 0));
    
    expect(engine.getProgress()).toBe(0.2); // 2/10
  });

  it('returns null if not enough samples', () => {
    const engine = new CalibrationEngine(5, 10.0);
    engine.addSample(createSample(0, 0, 0, 0));
    expect(engine.calibrate()).toBeNull();
  });

  it('generates a stable baseline and saves to localStorage', () => {
    const engine = new CalibrationEngine(3, 10.0);
    
    engine.addSample(createSample(1, 2, -0.1, 0.4));
    engine.addSample(createSample(2, 3, -0.1, 0.4));
    engine.addSample(createSample(3, 4, -0.1, 0.4));
    
    const baseline = engine.calibrate();
    expect(baseline).not.toBeNull();
    expect(baseline!.features.headTilt).toBe(2); // avg of 1, 2, 3
    expect(baseline!.features.shoulderRoll).toBe(3); // avg of 2, 3, 4
    
    const loaded = CalibrationEngine.loadBaseline();
    expect(loaded).not.toBeNull();
    expect(loaded!.features.headTilt).toBe(2);
  });

  it('throws an error and resets if variance is too high', () => {
    const engine = new CalibrationEngine(3, 5.0); // Strict variance threshold
    
    // Create wildly fluctuating samples
    engine.addSample(createSample(-20, -10, 0, 0.4));
    engine.addSample(createSample(0, 0, 0, 0.4));
    engine.addSample(createSample(20, 10, 0, 0.4));
    
    expect(() => engine.calibrate()).toThrow('Calibration unstable');
    expect(engine.getProgress()).toBe(0); // Should reset automatically
  });
});
