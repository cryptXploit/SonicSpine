import { PostureFeatures } from './types';
import { PostureBaseline } from './CalibrationEngine';
import { PostureConfig } from './config';

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
  
  private evidenceScore: number = 0; // 0 to 100

  constructor(smoothingFactor = 0.2) {
    this.smoothingFactor = smoothingFactor;
  }

  public process(current: PostureFeatures, baseline: PostureBaseline, nowMs: number): {
    smoothed: PostureFeatures,
    deviations: PostureDeviations,
    motionStability: number,
    stateFlags: {
      isDrifting: boolean,
      isCorrective: boolean,
      isRecovered: boolean
    },
    evidence: number
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

    // 3. Normalized Deviations from baseline
    // Normalize geometric ratios so multipliers don't explode based on absolute pixel sizes
    const headTiltDeviation = Math.abs(this.smoothedFeatures.headTilt - baseline.features.headTilt);
    const shoulderRollDeviation = Math.abs(this.smoothedFeatures.shoulderRoll - baseline.features.shoulderRoll);
    
    // Normalize crane and collapse relative to their baseline so it's a percentage change
    const rawCraneDeviation = Math.max(0, this.smoothedFeatures.forwardCraneRatio - baseline.features.forwardCraneRatio);
    const normalizedCrane = baseline.features.forwardCraneRatio > 0 ? (rawCraneDeviation / baseline.features.forwardCraneRatio) : rawCraneDeviation;

    const rawCollapseDeviation = Math.max(0, baseline.features.neckCollapseRatio - this.smoothedFeatures.neckCollapseRatio);
    const normalizedCollapse = baseline.features.neckCollapseRatio > 0 ? (rawCollapseDeviation / baseline.features.neckCollapseRatio) : rawCollapseDeviation;

    const isHeadTurned = this.smoothedFeatures.noseYawDeviation > 0.3; 
    
    // Weights are now applied to normalized percentages (0.0 to 1.0 usually)
    let penaltyCrane = normalizedCrane * PostureConfig.weights.crane;
    let penaltyCollapse = normalizedCollapse * PostureConfig.weights.collapse;
    let penaltyTilt = headTiltDeviation * PostureConfig.weights.headTilt;
    let penaltyRoll = shoulderRollDeviation * PostureConfig.weights.shoulderRoll;

    if (isHeadTurned) {
       penaltyCrane = 0;
       penaltyCollapse = 0;
    }

    let totalPenalty = penaltyTilt + penaltyRoll + penaltyCrane + penaltyCollapse;

    // Motion Gating: suppress penalty during rapid movement
    totalPenalty *= motionStability;

    const deviations: PostureDeviations = {
      headTiltDeviation: penaltyTilt,
      shoulderRollDeviation: penaltyRoll,
      craneDeviation: penaltyCrane,
      collapseDeviation: penaltyCollapse,
      totalPenalty
    };

    // 4. Evidence Accumulation (0 to 100)
    // Map penalty to an evidence delta.
    // If penalty is low (< 50), evidence decays. If penalty is high, evidence accumulates.
    const PENALTY_NEUTRAL = 60; // Tuning parameter: below this, we are recovering.
    
    const dtSeconds = dt / 1000;
    let evidenceDelta = 0;
    
    if (totalPenalty > PENALTY_NEUTRAL) {
      // Build up evidence based on how bad the posture is
      const severity = (totalPenalty - PENALTY_NEUTRAL) / 100.0; 
      evidenceDelta = severity * PostureConfig.evidence.accumulationRate * dtSeconds * 50; // Arbitrary multiplier to map to 0-100 scale over a few seconds
    } else {
      // Decay evidence
      evidenceDelta = -PostureConfig.evidence.decayRate * dtSeconds * 50;
    }

    this.evidenceScore = Math.max(0, Math.min(100, this.evidenceScore + evidenceDelta));

    let isDrifting = this.evidenceScore >= PostureConfig.evidence.driftThreshold;
    let isCorrective = this.evidenceScore >= PostureConfig.evidence.correctiveThreshold;
    let isRecovered = this.evidenceScore <= PostureConfig.evidence.recoveryThreshold;

    return {
      smoothed: { ...this.smoothedFeatures },
      deviations,
      motionStability,
      stateFlags: {
        isDrifting,
        isCorrective,
        isRecovered
      },
      evidence: this.evidenceScore
    };
  }

  public reset() {
    this.smoothedFeatures = null;
    this.lastFeatures = null;
    this.lastFrameTime = null;
    this.evidenceScore = 0;
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }
}
