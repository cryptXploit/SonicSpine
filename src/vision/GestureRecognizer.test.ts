import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestureRecognizer } from './GestureRecognizer';
import { PostureLandmarks, Point3D } from './types';

describe('GestureRecognizer (Continuous Finger Distance)', () => {
  let recognizer: GestureRecognizer;
  let onGesture: (event: number) => void;

  beforeEach(() => {
    onGesture = vi.fn();
    recognizer = new GestureRecognizer(onGesture);
  });

  const createPt = (x: number, y: number, z: number = 0, confidence: number = 0.9): Point3D => ({
    x, y, z, visibility: confidence, presence: confidence
  });

  const createLandmarks = (indexPos: [number, number], thumbPos: [number, number], handYOffset: number = 0): PostureLandmarks => {
    return {
      nose: createPt(0.5, 0.2), leftEar: createPt(0.4, 0.2), rightEar: createPt(0.6, 0.2),
      leftShoulder: createPt(0.3, 0.3), rightShoulder: createPt(0.7, 0.3), // width = 0.4
      leftIndex: createPt(indexPos[0], indexPos[1] + handYOffset),
      leftThumb: createPt(thumbPos[0], thumbPos[1] + handYOffset)
    };
  };

  it('outputs low volume when fingers are close', () => {
    // Body scale = 0.4
    // Finger distance = 0.02 (normalized = 0.02/0.4 = 0.05) -> should map to ~0.0 volume
    recognizer.process(createLandmarks([0.5, 0.5], [0.5, 0.52]));
    expect(onGesture).toHaveBeenCalled();
    const vol = vi.mocked(onGesture).mock.calls[0][0];
    expect(vol).toBeCloseTo(0.0, 1);
  });

  it('outputs high volume when fingers are far apart', () => {
    // Finger distance = 0.16 (normalized = 0.16/0.4 = 0.40) -> should clamp to 1.0 volume
    recognizer.process(createLandmarks([0.5, 0.5], [0.5, 0.66]));
    const vol = vi.mocked(onGesture).mock.calls[0][0];
    expect(vol).toBeCloseTo(1.0, 1);
  });

  it('outputs medium volume when fingers are moderately separated', () => {
    // Body scale = 0.4
    // min norm = 0.05, max norm = 0.35 -> range = 0.30
    // Dist = 0.08, norm = 0.20 -> (0.20 - 0.05) / 0.30 = 0.5 volume
    recognizer.process(createLandmarks([0.5, 0.5], [0.5, 0.58]));
    const vol = vi.mocked(onGesture).mock.calls[0][0];
    expect(vol).toBeCloseTo(0.5, 1);
  });

  it('ignores vertical hand displacement (Test D/E)', () => {
    // Dist = 0.08 -> 0.5 volume
    recognizer.process(createLandmarks([0.5, 0.5], [0.5, 0.58], 0.0));
    const vol1 = vi.mocked(onGesture).mock.calls[0][0];
    
    // Move whole hand UP by 0.2 (dist stays 0.08)
    recognizer.process(createLandmarks([0.5, 0.5], [0.5, 0.58], -0.2));
    const vol2 = vi.mocked(onGesture).mock.calls[1][0];

    // Volume should be identical
    expect(vol2).toBeCloseTo(vol1, 3);
  });

  it('smooths rapid changes (Exponential Moving Average)', () => {
    // Initial 0.0
    recognizer.process(createLandmarks([0.5, 0.5], [0.5, 0.52]));
    const vol1 = vi.mocked(onGesture).mock.calls[0][0];
    expect(vol1).toBeCloseTo(0.0, 5);

    // Suddenly jump to 1.0 distance
    recognizer.process(createLandmarks([0.5, 0.5], [0.5, 0.66]));
    const vol2 = vi.mocked(onGesture).mock.calls[1][0];
    
    // Alpha is 0.15, so 0.0 + 0.15*(1.0 - 0.0) = 0.15
    expect(vol2).toBeCloseTo(0.15, 2);
  });

  it('ignores low confidence landmarks', () => {
    const lms = createLandmarks([0.5, 0.5], [0.5, 0.66]);
    lms.leftThumb!.visibility = 0.2; // LOW CONFIDENCE
    recognizer.process(lms);
    
    expect(onGesture).not.toHaveBeenCalled();
  });
});
