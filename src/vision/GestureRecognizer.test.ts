import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestureRecognizer } from './GestureRecognizer';
import { PostureLandmarks, Point3D } from './types';

describe('GestureRecognizer (Two-Phase Model)', () => {
  let recognizer: GestureRecognizer;
  let onGesture: (event: number) => void;

  beforeEach(() => {
    onGesture = vi.fn();
    recognizer = new GestureRecognizer(onGesture);
  });

  const createPt = (x: number, y: number, z: number = 0, confidence: number = 1.0): Point3D => ({
    x, y, z, visibility: confidence, presence: confidence
  });

  const createHand = (
    indexExtension: number,
    pinchDist: number,
    handScale: number = 0.1,
    offsetX: number = 0,
    offsetY: number = 0
  ): PostureLandmarks => {
    const indexMCP = [0.5 + offsetX, 0.5 + offsetY];
    const indexTip = [indexMCP[0], indexMCP[1] - indexExtension];
    const thumbTip = [indexTip[0] - pinchDist, indexTip[1]];

    return {
      nose: createPt(0, 0), leftEar: createPt(0, 0), rightEar: createPt(0, 0),
      leftShoulder: createPt(0, 0), rightShoulder: createPt(0, 0),
      leftIndexMCP: createPt(indexMCP[0], indexMCP[1]),
      leftIndex: createPt(indexTip[0], indexTip[1]),
      leftThumb: createPt(thumbTip[0], thumbTip[1]),
      leftHandScale: handScale
    };
  };

  const processFrames = (lms: PostureLandmarks | null, count: number) => {
    for (let i = 0; i < count; i++) recognizer.process(lms);
  };

  it('1. NO HAND -> no volume control', () => {
    processFrames(null, 10);
    expect(recognizer.getState()).toBe('IDLE');
    expect(onGesture).not.toHaveBeenCalled();
  });

  it('2. OPEN PALM WITHOUT PRIOR PINCH -> NO activation', () => {
    // indexExtended = 1.0, pinchDist = 2.5
    const openPalm = createHand(0.1, 0.25, 0.1);
    processFrames(openPalm, 10);
    expect(recognizer.getState()).toBe('IDLE');
    expect(onGesture).not.toHaveBeenCalled();
  });

  it('3. FIST WITHOUT PRIOR PINCH -> NO activation', () => {
    // indexExtended = 0.5, pinchDist = 0.2
    const fist = createHand(0.05, 0.02, 0.1);
    processFrames(fist, 10);
    expect(recognizer.getState()).toBe('IDLE');
    expect(onGesture).not.toHaveBeenCalled();
  });

  it('4. HAND MOVEMENT WITHOUT ARMING -> NO activation', () => {
    // Open palm moving
    processFrames(createHand(0.1, 0.25, 0.1, 0.1, 0.1), 3);
    processFrames(createHand(0.1, 0.25, 0.1, 0.2, 0.2), 3);
    expect(recognizer.getState()).toBe('IDLE');
    expect(onGesture).not.toHaveBeenCalled();
  });

  it('5. THUMB + INDEX PINCH -> gesture arms', () => {
    // indexExtended = 1.0, pinchDist = 0.4
    const pinch = createHand(0.1, 0.04, 0.1);
    processFrames(pinch, 4); // ACTIVATION_FRAMES is 5
    expect(recognizer.getState()).toBe('IDLE');
    processFrames(pinch, 1);
    expect(recognizer.getState()).toBe('ACTIVE');
    expect(onGesture).toHaveBeenCalled();
  });

  it('6, 7, 8. AFTER ARMING - CLOSE, MEDIUM, FAR mapping', () => {
    processFrames(createHand(0.1, 0.04, 0.1), 5); // Arm

    // CLOSE: pinchDist = 0.15 (0%)
    processFrames(createHand(0.1, 0.015, 0.1), 100);
    expect(vi.mocked(onGesture).mock.calls.slice(-1)[0][0]).toBeCloseTo(0.0, 3);

    // MEDIUM: pinchDist = 0.675 (50%)
    processFrames(createHand(0.1, 0.0675, 0.1), 100);
    expect(vi.mocked(onGesture).mock.calls.slice(-1)[0][0]).toBeCloseTo(0.5, 1);

    // FAR: pinchDist = 1.2 (100%)
    processFrames(createHand(0.1, 0.12, 0.1), 100);
    expect(vi.mocked(onGesture).mock.calls.slice(-1)[0][0]).toBeCloseTo(1.0, 3);
  });

  it('9, 10. CLOSE -> FAR -> CLOSE smooth mapping', () => {
    processFrames(createHand(0.1, 0.04, 0.1), 5); // Arm
    
    processFrames(createHand(0.1, 0.015, 0.1), 100); // 0%
    const vol1 = vi.mocked(onGesture).mock.calls.slice(-1)[0][0];
    
    processFrames(createHand(0.1, 0.12, 0.1), 10); // Start moving to 100%
    const vol2 = vi.mocked(onGesture).mock.calls.slice(-1)[0][0];
    expect(vol2).toBeGreaterThan(vol1); // Smooth increase
    
    processFrames(createHand(0.1, 0.015, 0.1), 10); // Start moving to 0%
    const vol3 = vi.mocked(onGesture).mock.calls.slice(-1)[0][0];
    expect(vol3).toBeLessThan(vol2); // Smooth decrease
  });

  it('11. HAND TRANSLATION -> volume approx unchanged', () => {
    processFrames(createHand(0.1, 0.04, 0.1), 5); // Arm
    processFrames(createHand(0.1, 0.04, 0.1), 20); // Settle
    const vol1 = vi.mocked(onGesture).mock.calls.slice(-1)[0][0];

    // Move hand +0.3x, -0.2y
    processFrames(createHand(0.1, 0.04, 0.1, 0.3, -0.2), 10);
    const vol2 = vi.mocked(onGesture).mock.calls.slice(-1)[0][0];
    expect(vol2).toBe(vol1);
  });

  it('13. LANDMARK JITTER -> no unstable pumping', () => {
    processFrames(createHand(0.1, 0.04, 0.1), 5); // Arm
    processFrames(createHand(0.1, 0.0675, 0.1), 100); // Settle at 50%
    const vol1 = vi.mocked(onGesture).mock.calls.slice(-1)[0][0];

    // Tiny jitter within deadband (0.015)
    // 0.0675 -> 0.06751 (target diff very small)
    processFrames(createHand(0.1, 0.06751, 0.1), 10);
    const vol2 = vi.mocked(onGesture).mock.calls.slice(-1)[0][0];
    expect(vol2).toBe(vol1); // Deadband absorbed it
  });

  it('14. HAND DISAPPEARS -> gesture safely deactivates after timeout', () => {
    processFrames(createHand(0.1, 0.04, 0.1), 5); // Arm
    expect(recognizer.getState()).toBe('ACTIVE');

    processFrames(null, 5); // Under timeout
    expect(recognizer.getState()).toBe('ACTIVE');

    processFrames(null, 5); // Hits timeout (10 frames)
    expect(recognizer.getState()).toBe('IDLE');
  });

  it('15. HAND REAPPEARS WITHOUT PINCH -> does NOT automatically reactivate', () => {
    processFrames(createHand(0.1, 0.04, 0.1), 5); // Arm
    processFrames(null, 15); // Deactivate
    
    // Reappear as open palm
    processFrames(createHand(0.1, 0.25, 0.1), 10);
    expect(recognizer.getState()).toBe('IDLE'); // Should NOT re-arm
  });

  it('16. NEW PINCH AFTER REAPPEARANCE -> reactivates correctly', () => {
    processFrames(createHand(0.1, 0.04, 0.1), 5); // Arm
    processFrames(null, 15); // Deactivate
    expect(recognizer.getState()).toBe('IDLE');
    
    // Reappear as pinch
    processFrames(createHand(0.1, 0.04, 0.1), 5); // Arm again
    expect(recognizer.getState()).toBe('ACTIVE');
  });
});
