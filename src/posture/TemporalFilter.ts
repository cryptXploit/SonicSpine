import { PostureFeatures } from './types';
import { PostureBaseline } from './CalibrationEngine';

export interface PostureDeviations {
  headTiltDeviation: number;
  shoulderRollDeviation: number;
  depthDeviation: number;
}

export class TemporalFilter {
  private readonly smoothingFactor: number;
  private readonly driftThresholdMs: number;
  private readonly recoveryThresholdMs: number;

  private smoothedFeatures: PostureFeatures | null = null;
  
  private outOfBoundsStartTime: number | null = null;
  private inBoundsStartTime: number | null = null;

  // Tolerances
  private readonly tiltTolerance = 5.0; // degrees
  private readonly rollTolerance = 5.0; // degrees
  // MediaPipe Z values are proportional to image width. 
  // A forward lean typically causes a negative shift in Z relative to shoulders.
  // We use a relatively small threshold here.
  private readonly depthTolerance = 0.08; 

  constructor(smoothingFactor = 0.2, driftSecs = 3.0, recoverySecs = 1.5) {
    this.smoothingFactor = smoothingFactor;
    this.driftThresholdMs = driftSecs * 1000;
    this.recoveryThresholdMs = recoverySecs * 1000;
  }

  public process(current: PostureFeatures, baseline: PostureBaseline, nowMs: number): {
    smoothed: PostureFeatures,
    deviations: PostureDeviations,
    isSustainedDeviation: boolean,
    isSustainedRecovery: boolean,
    isInstantlyOutOfBounds: boolean
  } {
    // 1. Exponential Moving Average Smoothing
    if (!this.smoothedFeatures) {
      this.smoothedFeatures = { ...current };
    } else {
      this.smoothedFeatures.headTilt = this.lerp(this.smoothedFeatures.headTilt, current.headTilt, this.smoothingFactor);
      this.smoothedFeatures.shoulderRoll = this.lerp(this.smoothedFeatures.shoulderRoll, current.shoulderRoll, this.smoothingFactor);
      this.smoothedFeatures.neckForwardDepth = this.lerp(this.smoothedFeatures.neckForwardDepth, current.neckForwardDepth, this.smoothingFactor);
      this.smoothedFeatures.shoulderWidth = this.lerp(this.smoothedFeatures.shoulderWidth, current.shoulderWidth, this.smoothingFactor);
    }

    // 2. Calculate Deviations against Baseline
    // neckForwardDepth gets MORE negative when head comes closer to camera.
    // So if baseline is -0.1 and current is -0.3, difference is 0.2 (forward displacement)
    const forwardDisplacement = baseline.features.neckForwardDepth - this.smoothedFeatures.neckForwardDepth;

    const deviations: PostureDeviations = {
      headTiltDeviation: Math.abs(this.smoothedFeatures.headTilt - baseline.features.headTilt),
      shoulderRollDeviation: Math.abs(this.smoothedFeatures.shoulderRoll - baseline.features.shoulderRoll),
      depthDeviation: forwardDisplacement
    };

    // 3. Check Bounds
    const isOutOfBounds = 
      deviations.headTiltDeviation > this.tiltTolerance ||
      deviations.shoulderRollDeviation > this.rollTolerance ||
      deviations.depthDeviation > this.depthTolerance;

    if (isOutOfBounds) {
      this.inBoundsStartTime = null;
      if (!this.outOfBoundsStartTime) {
        this.outOfBoundsStartTime = nowMs;
      }
    } else {
      this.outOfBoundsStartTime = null;
      if (!this.inBoundsStartTime) {
        this.inBoundsStartTime = nowMs;
      }
    }

    const isSustainedDeviation = this.outOfBoundsStartTime !== null && 
      (nowMs - this.outOfBoundsStartTime) >= this.driftThresholdMs;

    const isSustainedRecovery = this.inBoundsStartTime !== null && 
      (nowMs - this.inBoundsStartTime) >= this.recoveryThresholdMs;

    return {
      smoothed: { ...this.smoothedFeatures },
      deviations,
      isSustainedDeviation,
      isSustainedRecovery,
      isInstantlyOutOfBounds: isOutOfBounds
    };
  }

  public reset() {
    this.smoothedFeatures = null;
    this.outOfBoundsStartTime = null;
    this.inBoundsStartTime = null;
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }
}
