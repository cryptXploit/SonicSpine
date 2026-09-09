import { describe, it, expect } from 'vitest';
import { TemporalFilter } from './TemporalFilter';
import { PostureFeatures } from './types';
import { PostureBaseline } from './CalibrationEngine';

describe('TemporalFilter', () => {
  const createFeatures = (tilt: number, roll: number, depth: number): PostureFeatures => ({
    headTilt: tilt,
    shoulderRoll: roll,
    neckForwardDepth: depth,
    shoulderWidth: 0.4
  });

  const baseline: PostureBaseline = {
    features: createFeatures(0, 0, -0.1),
    timestamp: 0
  };

  it('applies exponential moving average smoothing', () => {
    // factor 0.5 means it moves 50% of the way to the new value each frame
    const filter = new TemporalFilter(0.5, 3.0, 1.5);
    
    // First frame initializes the smoothed value directly
    let res = filter.process(createFeatures(10, 0, -0.1), baseline, 0);
    expect(res.smoothed.headTilt).toBe(10);
    
    // Second frame: start is 10, current is 20, 50% lerp -> 15
    res = filter.process(createFeatures(20, 0, -0.1), baseline, 100);
    expect(res.smoothed.headTilt).toBe(15);

    // Third frame: start is 15, current is 20, 50% lerp -> 17.5
    res = filter.process(createFeatures(20, 0, -0.1), baseline, 200);
    expect(res.smoothed.headTilt).toBe(17.5);
  });

  it('detects sustained deviation (debounce)', () => {
    // 3.0s drift threshold
    const filter = new TemporalFilter(1.0, 3.0, 1.5); // factor 1.0 (no smoothing) for easy math
    
    // Within tolerance (tilt < 5)
    let res = filter.process(createFeatures(4, 0, -0.1), baseline, 0);
    expect(res.isInstantlyOutOfBounds).toBe(false);
    expect(res.isSustainedDeviation).toBe(false);

    // Out of bounds (tilt > 5) at 1000ms
    res = filter.process(createFeatures(10, 0, -0.1), baseline, 1000);
    expect(res.isInstantlyOutOfBounds).toBe(true);
    expect(res.isSustainedDeviation).toBe(false); // Not sustained yet

    // Still out of bounds at 2000ms (1 sec passed)
    res = filter.process(createFeatures(10, 0, -0.1), baseline, 2000);
    expect(res.isSustainedDeviation).toBe(false);

    // Out of bounds at 4000ms (3 secs passed)
    res = filter.process(createFeatures(10, 0, -0.1), baseline, 4000);
    expect(res.isSustainedDeviation).toBe(true); // Now it's sustained
  });

  it('resets deviation timer if user recovers quickly', () => {
    const filter = new TemporalFilter(1.0, 3.0, 1.5);
    
    // Out of bounds at 0ms
    filter.process(createFeatures(10, 0, -0.1), baseline, 0);
    
    // Back in bounds at 1000ms (quick recovery)
    let res = filter.process(createFeatures(0, 0, -0.1), baseline, 1000);
    expect(res.isSustainedDeviation).toBe(false);
    expect(res.isInstantlyOutOfBounds).toBe(false);

    // Out of bounds again at 2000ms
    res = filter.process(createFeatures(10, 0, -0.1), baseline, 2000);
    expect(res.isSustainedDeviation).toBe(false); // Timer restarted

    // At 4000ms, only 2 secs passed since last out-of-bounds start
    res = filter.process(createFeatures(10, 0, -0.1), baseline, 4000);
    expect(res.isSustainedDeviation).toBe(false); 
  });

  it('detects sustained recovery (hysteresis)', () => {
    // 1.5s recovery threshold
    const filter = new TemporalFilter(1.0, 3.0, 1.5);
    
    // Start out of bounds
    filter.process(createFeatures(10, 0, -0.1), baseline, 0);

    // In bounds at 1000ms
    let res = filter.process(createFeatures(0, 0, -0.1), baseline, 1000);
    expect(res.isSustainedRecovery).toBe(false); // Not 1.5s yet

    // In bounds at 2000ms (1 sec passed)
    res = filter.process(createFeatures(0, 0, -0.1), baseline, 2000);
    expect(res.isSustainedRecovery).toBe(false);

    // In bounds at 2500ms (1.5 secs passed)
    res = filter.process(createFeatures(0, 0, -0.1), baseline, 2500);
    expect(res.isSustainedRecovery).toBe(true); // Now recovered
  });
});
