import { PostureFeatures } from './types';
import { PostureBaseline } from './CalibrationEngine';

export interface PostureDeviations {
  headTiltDeviation: number;
  shoulderRollDeviation: number;
  craneDeviation: number;
  collapseDeviation: number;
  totalPenalty: number;
}

export class TemporalFilter {
  private readonly smoothingFactor: number;
  private readonly driftThresholdMs: number;
  private readonly recoveryThresholdMs: number;

  private smoothedFeatures: PostureFeatures | null = null;
  
  private outOfBoundsStartTime: number | null = null;
  private inBoundsStartTime: number | null = null;

  // We assign a penalty score to deviations.
  // 0-100 scale. If penalty > 100, we consider it out of bounds.
  private readonly penaltyThreshold = 100.0;

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
      this.smoothedFeatures.forwardCraneRatio = this.lerp(this.smoothedFeatures.forwardCraneRatio, current.forwardCraneRatio, this.smoothingFactor);
      this.smoothedFeatures.neckCollapseRatio = this.lerp(this.smoothedFeatures.neckCollapseRatio, current.neckCollapseRatio, this.smoothingFactor);
      this.smoothedFeatures.noseYawDeviation = this.lerp(this.smoothedFeatures.noseYawDeviation || 0, current.noseYawDeviation, this.smoothingFactor);
    }

    // 2. Calculate Deviations against Baseline
    const headTiltDeviation = Math.abs(this.smoothedFeatures.headTilt - baseline.features.headTilt);
    const shoulderRollDeviation = Math.abs(this.smoothedFeatures.shoulderRoll - baseline.features.shoulderRoll);
    
    // forward crane ratio increases when user leans forward (head gets bigger relative to shoulders)
    // We only penalize if it gets LARGER than baseline (leaning forward).
    const craneDiff = this.smoothedFeatures.forwardCraneRatio - baseline.features.forwardCraneRatio;
    const craneDeviation = Math.max(0, craneDiff); 

    // neck collapse ratio decreases when user slouches (ears get closer to shoulders)
    // We only penalize if it gets SMALLER than baseline (slouching).
    const collapseDiff = baseline.features.neckCollapseRatio - this.smoothedFeatures.neckCollapseRatio;
    const collapseDeviation = Math.max(0, collapseDiff);

    // 3. Handle Head Turn (Yaw)
    // If the user turns their head, 2D geometric projections break down.
    // Instead of falsely punishing them for slouching/craning, we reduce the penalty.
    const isHeadTurned = this.smoothedFeatures.noseYawDeviation > 0.3; 
    
    // 4. Multi-signal Weighted Scoring
    // We reduce the crane weight because 2D perspective scale changes are subtle and noisy.
    // We increase collapse weight because ears-to-shoulder is extremely stable and highly correlated with slumping and tech-neck.
    let totalPenalty = 
      (headTiltDeviation * 10) + 
      (shoulderRollDeviation * 5) + 
      (craneDeviation * 1000) + 
      (collapseDeviation * 3500);

    if (isHeadTurned) {
       // Suppress geometric penalties when head is turned (user is looking at second monitor, etc)
       totalPenalty = (headTiltDeviation * 10) + (shoulderRollDeviation * 5); 
    }

    const deviations: PostureDeviations = {
      headTiltDeviation,
      shoulderRollDeviation,
      craneDeviation,
      collapseDeviation,
      totalPenalty
    };

    const isOutOfBounds = totalPenalty > this.penaltyThreshold;

    if (isOutOfBounds) {
      this.inBoundsStartTime = null;
      if (this.outOfBoundsStartTime === null) {
        this.outOfBoundsStartTime = nowMs;
      }
    } else {
      this.outOfBoundsStartTime = null;
      if (this.inBoundsStartTime === null) {
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
