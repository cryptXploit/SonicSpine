import { describe, it, expect, vi } from 'vitest';
import { PostureStateMachine, StateContext } from './PostureStateMachine';

describe('PostureStateMachine', () => {
  const createCtx = (overrides: Partial<StateContext> = {}): StateContext => ({
    confidence: 'HIGH',
    isInstantlyOutOfBounds: false,
    isSustainedDeviation: false,
    isSustainedRecovery: false,
    ...overrides
  });

  it('initializes in BOOT state', () => {
    const sm = new PostureStateMachine();
    expect(sm.getState()).toBe('BOOT');
  });

  it('progresses through setup flow', () => {
    const sm = new PostureStateMachine();
    sm.triggerCameraReady();
    expect(sm.getState()).toBe('CAMERA_READY');
    
    sm.startCalibration();
    expect(sm.getState()).toBe('CALIBRATING');
    
    sm.finishCalibration();
    expect(sm.getState()).toBe('GOOD'); // Skips to active tracking
  });

  it('triggers callback on state change', () => {
    const cb = vi.fn();
    const sm = new PostureStateMachine(cb);
    sm.triggerCameraReady();
    expect(cb).toHaveBeenCalledWith('CAMERA_READY');
  });

  describe('Active Tracking Flow', () => {
    it('drifts and corrects', () => {
      const sm = new PostureStateMachine();
      sm.triggerCameraReady();
      sm.startCalibration();
      sm.finishCalibration(); // state is GOOD

      // Instant deviation triggers DRIFTING
      sm.processFrame(createCtx({ isInstantlyOutOfBounds: true }));
      expect(sm.getState()).toBe('DRIFTING');

      // Sustained deviation triggers CORRECTIVE
      sm.processFrame(createCtx({ isInstantlyOutOfBounds: true, isSustainedDeviation: true }));
      expect(sm.getState()).toBe('CORRECTIVE');

      // Coming back in bounds triggers RECOVERING
      sm.processFrame(createCtx({ isInstantlyOutOfBounds: false, isSustainedDeviation: true }));
      expect(sm.getState()).toBe('RECOVERING');

      // Holding it triggers GOOD
      sm.processFrame(createCtx({ isInstantlyOutOfBounds: false, isSustainedRecovery: true }));
      expect(sm.getState()).toBe('GOOD');
    });

    it('returns to GOOD if drift is not sustained (quick movement)', () => {
      const sm = new PostureStateMachine();
      sm.triggerCameraReady();
      sm.startCalibration();
      sm.finishCalibration();

      sm.processFrame(createCtx({ isInstantlyOutOfBounds: true }));
      expect(sm.getState()).toBe('DRIFTING');

      sm.processFrame(createCtx({ isInstantlyOutOfBounds: false }));
      expect(sm.getState()).toBe('GOOD'); // False alarm
    });

    it('returns to CORRECTIVE if recovering but drops back out', () => {
      const sm = new PostureStateMachine();
      sm.triggerCameraReady();
      sm.startCalibration();
      sm.finishCalibration();

      sm.processFrame(createCtx({ isInstantlyOutOfBounds: true }));
      sm.processFrame(createCtx({ isInstantlyOutOfBounds: true, isSustainedDeviation: true })); // jumps to CORRECTIVE
      expect(sm.getState()).toBe('CORRECTIVE');

      sm.processFrame(createCtx({ isInstantlyOutOfBounds: false }));
      expect(sm.getState()).toBe('RECOVERING');

      // Oops, slouched again
      sm.processFrame(createCtx({ isInstantlyOutOfBounds: true }));
      expect(sm.getState()).toBe('CORRECTIVE');
    });

    it('handles LOW_CONFIDENCE gracefully', () => {
      const sm = new PostureStateMachine();
      sm.triggerCameraReady();
      sm.startCalibration();
      sm.finishCalibration();

      sm.processFrame(createCtx({ confidence: 'LOW' }));
      expect(sm.getState()).toBe('LOW_CONFIDENCE');

      // Recovers directly to GOOD if everything is fine
      sm.processFrame(createCtx({ confidence: 'HIGH', isInstantlyOutOfBounds: false }));
      expect(sm.getState()).toBe('GOOD');
    });
  });
});
