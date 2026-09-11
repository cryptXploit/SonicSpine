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
  private readonly correctiveThresholdMs: number;
  private readonly recoveryThresholdMs: number;

  private smoothedFeatures: PostureFeatures | null = null;
  private lastFeatures: PostureFeatures | null = null;
  private lastFrameTime: number | null = null;
  
  private outOfBoundsStartTime: number | null = null;
  private inBoundsStartTime: number | null = null;

  // Hysteresis thresholds
  private readonly PENALTY_DRIFT = 80.0;
  private readonly PENALTY_CORRECTIVE = 120.0;
  private readonly PENALTY_RECOVER = 70.0;

  constructor(smoothingFactor = 0.2, driftSecs = 1.5, correctiveSecs = 3.0, recoverySecs = 2.0) {
    this.smoothingFactor = smoothingFactor;
    this.driftThresholdMs = driftSecs * 1000;
    this.correctiveThresholdMs = correctiveSecs * 1000;
    this.recoveryThresholdMs = recoverySecs * 1000;
  }

  public process(current: PostureFeatures, baseline: PostureBaseline, nowMs: number): {
    smoothed: PostureFeatures,
    deviations: PostureDeviations,
    motionStability: number,
    stateFlags: {
      isDrifting: boolean,
      isCorrective: boolean,
      isRecovered: boolean
    }
  } {
    let dt = 16.6; // ~60fps default
    if (this.lastFrameTime !== null) {
      dt = Math.max(1, nowMs - this.lastFrameTime);
    }
    this.lastFrameTime = nowMs;

    // 1. Calculate Motion Stability (Velocity of features)
    let motionStability = 1.0;
    if (this.lastFeatures) {
      const tiltVel = Math.abs(current.headTilt - this.lastFeatures.headTilt) / dt;
      const rollVel = Math.abs(current.shoulderRoll - this.lastFeatures.shoulderRoll) / dt;
      // High velocity -> low stability
      const totalVel = tiltVel + rollVel;
      motionStability = Math.max(0.0, 1.0 - (totalVel * 2.0)); 
    }
    this.lastFeatures = { ...current };

    // 2. Exponential Moving Average Smoothing
    if (!this.smoothedFeatures) {
      this.smoothedFeatures = { ...current };
    } else {
      // Dynamic smoothing based on motion - smooth heavily if moving fast, react quickly if still
      const dynamicSmoothing = this.lerp(0.05, this.smoothingFactor, motionStability);
      
      this.smoothedFeatures.headTilt = this.lerp(this.smoothedFeatures.headTilt, current.headTilt, dynamicSmoothing);
      this.smoothedFeatures.shoulderRoll = this.lerp(this.smoothedFeatures.shoulderRoll, current.shoulderRoll, dynamicSmoothing);
      this.smoothedFeatures.forwardCraneRatio = this.lerp(this.smoothedFeatures.forwardCraneRatio, current.forwardCraneRatio, dynamicSmoothing);
      this.smoothedFeatures.neckCollapseRatio = this.lerp(this.smoothedFeatures.neckCollapseRatio, current.neckCollapseRatio, dynamicSmoothing);
      this.smoothedFeatures.noseYawDeviation = this.lerp(this.smoothedFeatures.noseYawDeviation || 0, current.noseYawDeviation, dynamicSmoothing);
    }

    // 3. Deviations from baseline
    const headTiltDeviation = Math.abs(this.smoothedFeatures.headTilt - baseline.features.headTilt);
    const shoulderRollDeviation = Math.abs(this.smoothedFeatures.shoulderRoll - baseline.features.shoulderRoll);
    const craneDeviation = Math.max(0, this.smoothedFeatures.forwardCraneRatio - baseline.features.forwardCraneRatio); 
    const collapseDeviation = Math.max(0, baseline.features.neckCollapseRatio - this.smoothedFeatures.neckCollapseRatio);

    const isHeadTurned = this.smoothedFeatures.noseYawDeviation > 0.3; 
    
    let totalPenalty = 
      (headTiltDeviation * 10) + 
      (shoulderRollDeviation * 5) + 
      (craneDeviation * 1000) + 
      (collapseDeviation * 3500);

    if (isHeadTurned) {
       totalPenalty = (headTiltDeviation * 10) + (shoulderRollDeviation * 5); 
    }

    // Motion Gating: if user is moving quickly (e.g. reaching), suppress penalty so it doesn't instantly jump
    totalPenalty *= motionStability;

    const deviations: PostureDeviations = {
      headTiltDeviation,
      shoulderRollDeviation,
      craneDeviation,
      collapseDeviation,
      totalPenalty
    };

    // 4. Temporal Accumulation with Hysteresis
    if (totalPenalty >= this.PENALTY_DRIFT) {
      this.inBoundsStartTime = null;
      if (this.outOfBoundsStartTime === null) {
        this.outOfBoundsStartTime = nowMs;
      }
    } else if (totalPenalty <= this.PENALTY_RECOVER) {
      this.outOfBoundsStartTime = null;
      if (this.inBoundsStartTime === null) {
        this.inBoundsStartTime = nowMs;
      }
    }
    // If penalty is between 70 and 80, we maintain current timers (Hysteresis middle zone)

    let isDrifting = false;
    let isCorrective = false;
    let isRecovered = false;

    if (this.outOfBoundsStartTime !== null) {
      const duration = nowMs - this.outOfBoundsStartTime;
      if (duration >= this.correctiveThresholdMs || totalPenalty >= this.PENALTY_CORRECTIVE) {
        isCorrective = true;
      } else if (duration >= this.driftThresholdMs) {
        isDrifting = true;
      }
    }

    if (this.inBoundsStartTime !== null) {
      const duration = nowMs - this.inBoundsStartTime;
      if (duration >= this.recoveryThresholdMs) {
        isRecovered = true;
      }
    }

    return {
      smoothed: { ...this.smoothedFeatures },
      deviations,
      motionStability,
      stateFlags: {
        isDrifting,
        isCorrective,
        isRecovered
      }
    };
  }

  public reset() {
    this.smoothedFeatures = null;
    this.lastFeatures = null;
    this.lastFrameTime = null;
    this.outOfBoundsStartTime = null;
    this.inBoundsStartTime = null;
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }
}
