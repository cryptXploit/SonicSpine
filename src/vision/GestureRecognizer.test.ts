import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestureRecognizer } from './GestureRecognizer';
import { PostureLandmarks, Point3D } from './types';

describe('GestureRecognizer', () => {
  let recognizer: GestureRecognizer;
  let onGesture: (event: string) => void;

  beforeEach(() => {
    onGesture = vi.fn();
    recognizer = new GestureRecognizer(onGesture);
  });

  const createWrist = (y: number, confidence: number = 0.9): Point3D => ({
    x: 0.5, y, z: 0, visibility: confidence, presence: confidence
  });

  const createLandmarks = (wristY: number | null): PostureLandmarks | null => {
    if (wristY === null) return null;
    return {
      nose: createWrist(0.2), leftEar: createWrist(0.2), rightEar: createWrist(0.2),
      leftShoulder: createWrist(0.3), rightShoulder: createWrist(0.3),
      leftWrist: createWrist(wristY) // We only populate leftWrist for testing
    };
  };

  it('detects a valid VOLUME_UP gesture', () => {
    let now = 0;
    
    // Initial tracking
    recognizer.process(createLandmarks(0.8), now);
    expect(recognizer.getState()).toBe('TRACKING');

    // Move up (smaller Y) consistently
    recognizer.process(createLandmarks(0.7), now += 100);
    recognizer.process(createLandmarks(0.6), now += 100);
    recognizer.process(createLandmarks(0.5), now += 100);
    
    // Final move exceeds displacement threshold (0.8 - 0.5 = 0.3 > 0.15)
    expect(onGesture).toHaveBeenCalledWith('VOLUME_UP');
    expect(recognizer.getState()).toBe('COOLDOWN');
  });

  it('detects a valid VOLUME_DOWN gesture', () => {
    let now = 0;
    recognizer.process(createLandmarks(0.3), now);
    recognizer.process(createLandmarks(0.4), now += 100);
    recognizer.process(createLandmarks(0.5), now += 100);
    recognizer.process(createLandmarks(0.6), now += 100);
    
    expect(onGesture).toHaveBeenCalledWith('VOLUME_DOWN');
  });

  it('rejects typing micro-movements (fails displacement)', () => {
    let now = 0;
    recognizer.process(createLandmarks(0.5), now);
    recognizer.process(createLandmarks(0.49), now += 100);
    recognizer.process(createLandmarks(0.48), now += 100);
    recognizer.process(createLandmarks(0.47), now += 100);
    
    // Moved up 4 frames, but only 0.03 total displacement
    expect(onGesture).not.toHaveBeenCalled();
    expect(recognizer.getState()).toBe('TRACKING');
  });

  it('rejects waving (inconsistent direction)', () => {
    let now = 0;
    recognizer.process(createLandmarks(0.5), now);
    recognizer.process(createLandmarks(0.4), now += 100); // UP
    recognizer.process(createLandmarks(0.45), now += 100); // DOWN -> Break gesture
    
    expect(onGesture).not.toHaveBeenCalled();
    expect(recognizer.getState()).toBe('IDLE');
  });

  it('enforces cooldown', () => {
    let now = 0;
    recognizer.process(createLandmarks(0.8), now);
    recognizer.process(createLandmarks(0.7), now += 100);
    recognizer.process(createLandmarks(0.6), now += 100);
    recognizer.process(createLandmarks(0.5), now += 100);
    
    expect(onGesture).toHaveBeenCalledTimes(1);

    // Keep moving up immediately
    recognizer.process(createLandmarks(0.4), now += 100);
    recognizer.process(createLandmarks(0.3), now += 100);
    recognizer.process(createLandmarks(0.2), now += 100);
    
    // Ignored due to cooldown
    expect(onGesture).toHaveBeenCalledTimes(1);
    expect(recognizer.getState()).toBe('COOLDOWN');

    // After cooldown ms, it resets
    now += 1500;
    recognizer.process(createLandmarks(0.2), now);
    expect(recognizer.getState()).toBe('TRACKING');
  });

  it('ignores low confidence wrists', () => {
    let now = 0;
    const lms = createLandmarks(0.5);
    lms!.leftWrist!.visibility = 0.2; // LOW CONFIDENCE

    recognizer.process(lms, now);
    expect(recognizer.getState()).toBe('IDLE');
  });
});
