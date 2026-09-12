import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostureStateMachine, StateContext } from './PostureStateMachine';
import { ConfidenceResult } from '../vision/ConfidenceEstimator';
import { SettingsManager } from '../settings/SettingsManager';

describe('PostureStateMachine', () => {
  let sm: PostureStateMachine;
  let onStateChange: (state: string) => void;
  const highConf: ConfidenceResult = { level: 'HIGH', score: 0.9, details: { headVisible: true, shouldersVisible: true } };
  const lowConf: ConfidenceResult = { level: 'LOW', score: 0.3, details: { headVisible: false, shouldersVisible: false } };

  beforeEach(() => {
    onStateChange = vi.fn();
    sm = new PostureStateMachine(onStateChange as any);
  });

  const createCtx = (overrides: Partial<StateContext> = {}): StateContext => ({
    confidence: highConf,
    stateFlags: {
      isDrifting: false,
      isCorrective: false,
      isRecovered: false
    },
    ...overrides
  });

  describe('Initialization and Calibration', () => {
    it('starts in BOOT state', () => {
      expect(sm.getState()).toBe('BOOT');
    });

    it('transitions BOOT -> CAMERA_READY -> CALIBRATING -> READY -> GOOD', () => {
      sm.triggerCameraReady();
      expect(sm.getState()).toBe('CAMERA_READY');

      sm.startCalibration();
      expect(sm.getState()).toBe('CALIBRATING');

      sm.finishCalibration();
      expect(sm.getState()).toBe('GOOD'); // It goes READY -> GOOD immediately
    });
  });

  describe('Active Tracking Flow', () => {
    beforeEach(() => {
      sm.triggerCameraReady();
      sm.startCalibration();
      sm.finishCalibration(); // state is now GOOD
    });

    it('drifts and corrects', () => {
      // 1. Enter Drifting
      sm.processFrame(createCtx({ stateFlags: { isDrifting: true, isCorrective: false, isRecovered: false } }));
      expect(sm.getState()).toBe('DRIFTING');

      // 2. Enter Corrective
      sm.processFrame(createCtx({ stateFlags: { isDrifting: true, isCorrective: true, isRecovered: false } }));
      expect(sm.getState()).toBe('CORRECTIVE');

      // 3. Enter Recovering
      sm.processFrame(createCtx({ stateFlags: { isDrifting: false, isCorrective: false, isRecovered: false } }));
      expect(sm.getState()).toBe('RECOVERING');

      // 4. Return to Good
      sm.processFrame(createCtx({ stateFlags: { isDrifting: false, isCorrective: false, isRecovered: true } }));
      expect(sm.getState()).toBe('GOOD');
    });

    it('returns to GOOD if drift is not sustained (quick movement)', () => {
      // Temporarily drift
      sm.processFrame(createCtx({ stateFlags: { isDrifting: true, isCorrective: false, isRecovered: false } }));
      expect(sm.getState()).toBe('DRIFTING');

      // But recovered before CORRECTIVE
      sm.processFrame(createCtx({ stateFlags: { isDrifting: false, isCorrective: false, isRecovered: true } }));
      expect(sm.getState()).toBe('GOOD');
    });

    it('returns to CORRECTIVE if recovering but drops back out', () => {
      sm.processFrame(createCtx({ stateFlags: { isDrifting: true, isCorrective: true, isRecovered: false } }));
      expect(sm.getState()).toBe('CORRECTIVE');

      sm.processFrame(createCtx({ stateFlags: { isDrifting: false, isCorrective: false, isRecovered: false } }));
      expect(sm.getState()).toBe('RECOVERING');

      // Drops back out
      sm.processFrame(createCtx({ stateFlags: { isDrifting: true, isCorrective: true, isRecovered: false } }));
      expect(sm.getState()).toBe('CORRECTIVE');
    });

    it('handles LOW_CONFIDENCE gracefully with a timeout', () => {
      // Should ignore first low confidence frame (state stays GOOD)
      sm.processFrame(createCtx({ confidence: lowConf }), 0);
      expect(sm.getState()).toBe('GOOD');

      // Fast forward 5001ms
      sm.processFrame(createCtx({ confidence: lowConf }), 5001);
      expect(sm.getState()).toBe('LOW_CONFIDENCE');

      // Recover
      sm.processFrame(createCtx({ confidence: highConf }), 5002);
      expect(sm.getState()).toBe('GOOD');
    });

    it('handles user absence (NONE confidence) gracefully with a timeout', () => {
      const noneConf: ConfidenceResult = { level: 'NONE', score: 0, details: { headVisible: false, shouldersVisible: false } };
      sm.processFrame(createCtx({ confidence: noneConf }), 0);
      expect(sm.getState()).toBe('GOOD');

      // Fast forward 5001ms (using default SettingsManager screenPresenceGracePeriodMs)
      sm.processFrame(createCtx({ confidence: noneConf }), 5001);
      expect(sm.getState()).toBe('LOW_CONFIDENCE');
    });

    it('handles Recovery Delay correctly', () => {
      // We will mutate the real SettingsManager since we are not fully resetting modules in this test,
      // but we will restore it after.
      const originalGetSettings = SettingsManager.getSettings;
      SettingsManager.getSettings = vi.fn().mockReturnValue({
        screenPresenceGracePeriodMs: 5000,
        recoveryDelayMs: 2000,
        lowConfidenceAudioBehavior: 'CLEAR'
      });

      sm.processFrame(createCtx({ stateFlags: { isDrifting: true, isCorrective: true, isRecovered: false } }), 0);
      expect(sm.getState()).toBe('CORRECTIVE');

      sm.processFrame(createCtx({ stateFlags: { isDrifting: false, isCorrective: false, isRecovered: false } }), 100);
      expect(sm.getState()).toBe('RECOVERING');

      // Now isRecovered becomes true, but we have a 2000ms delay
      sm.processFrame(createCtx({ stateFlags: { isDrifting: false, isCorrective: false, isRecovered: true } }), 200);
      expect(sm.getState()).toBe('RECOVERING'); // Should still be recovering!

      // Fast forward 1000ms
      sm.processFrame(createCtx({ stateFlags: { isDrifting: false, isCorrective: false, isRecovered: true } }), 1200);
      expect(sm.getState()).toBe('RECOVERING');

      // Fast forward past 2000ms
      sm.processFrame(createCtx({ stateFlags: { isDrifting: false, isCorrective: false, isRecovered: true } }), 2200);
      expect(sm.getState()).toBe('GOOD');
      
      // Restore the mock
      SettingsManager.getSettings = originalGetSettings;
    });
  });
});
