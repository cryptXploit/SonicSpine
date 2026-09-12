import { describe, it, expect } from 'vitest';
import { SessionManager } from './SessionManager';

describe('SessionManager', () => {
  it('starts and ends a session returning correct base analytics', () => {
    const manager = new SessionManager();
    manager.startSession(1000);
    const result = manager.endSession(2000);

    expect(result).not.toBeNull();
    expect(result?.totalSessionDurationMs).toBe(1000);
    expect(result?.healthScore).toBe(100);
    expect(result?.deviationCount).toBe(0);
  });

  it('accumulates time correctly across states', () => {
    const manager = new SessionManager();
    manager.startSession(0); // READY

    manager.updateState('GOOD', 1000); // 1000ms in READY (Good)
    manager.updateState('DRIFTING', 2000); // 1000ms in GOOD (Good)
    manager.updateState('CORRECTIVE', 4000); // 2000ms in DRIFTING
    manager.updateState('RECOVERING', 7000); // 3000ms in CORRECTIVE

    const result = manager.endSession(8000); // 1000ms in RECOVERING (Good)

    expect(result?.timeInGoodMs).toBe(3000); // 1000(READY) + 1000(GOOD) + 1000(RECOVERING)
    expect(result?.timeInDriftingMs).toBe(2000);
    expect(result?.timeInCorrectiveMs).toBe(3000);
    expect(result?.totalSessionDurationMs).toBe(8000);
    
    // deviationCount: GOOD -> DRIFTING happened once
    expect(result?.deviationCount).toBe(1);
  });

  it('calculates health score accurately', () => {
    const manager = new SessionManager();
    manager.startSession(0); // READY
    
    // Total tracked time = 10,000ms
    manager.updateState('GOOD', 1000); // 1000ms Good
    manager.updateState('DRIFTING', 6000); // 5000ms Good
    manager.updateState('CORRECTIVE', 8000); // 2000ms Drifting
    const result = manager.endSession(10000); // 2000ms Corrective

    // Good: 6000, Drifting: 2000, Corrective: 2000
    // Score: (6000 + (2000 * 0.5)) / 10000 = 7000 / 10000 = 70%
    expect(result?.healthScore).toBe(70);
  });

  it('returns null if ending without starting', () => {
    const manager = new SessionManager();
    expect(manager.endSession(1000)).toBeNull();
  });

  it('tracks LOW_CONFIDENCE without penalizing health score', () => {
    const manager = new SessionManager();
    manager.startSession(0); // READY
    
    // Good for 5000ms
    manager.updateState('LOW_CONFIDENCE', 5000); 
    
    // Away for 5000ms
    const result = manager.endSession(10000); 

    // Total tracked time for score = 5000ms (Good)
    // Low confidence time = 5000ms
    // Score should be 100% based on the 5000ms they were actually tracked
    expect(result?.timeInGoodMs).toBe(5000);
    expect(result?.timeInLowConfidenceMs).toBe(5000);
    expect(result?.healthScore).toBe(100);
    expect(result?.totalSessionDurationMs).toBe(10000);
  });
});
