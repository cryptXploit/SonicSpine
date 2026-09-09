import { PostureFeatures } from './types';

export interface PostureBaseline {
  features: PostureFeatures;
  timestamp: number;
}

export class CalibrationEngine {
  private samples: PostureFeatures[] = [];
  private readonly requiredSamples: number;
  private readonly maxVariance: number;

  constructor(requiredSamples: number = 30, maxVariance: number = 10.0) {
    this.requiredSamples = requiredSamples;
    this.maxVariance = maxVariance;
  }

  public addSample(features: PostureFeatures): void {
    this.samples.push(features);
  }

  public getProgress(): number {
    return Math.min(this.samples.length / this.requiredSamples, 1.0);
  }

  public calibrate(): PostureBaseline | null {
    if (this.samples.length < this.requiredSamples) {
      return null;
    }

    // Calculate averages
    const sum = this.samples.reduce((acc, curr) => ({
      shoulderRoll: acc.shoulderRoll + curr.shoulderRoll,
      headTilt: acc.headTilt + curr.headTilt,
      forwardCraneRatio: acc.forwardCraneRatio + curr.forwardCraneRatio,
      neckCollapseRatio: acc.neckCollapseRatio + curr.neckCollapseRatio
    }), { shoulderRoll: 0, headTilt: 0, forwardCraneRatio: 0, neckCollapseRatio: 0 });

    const n = this.samples.length;
    const avg: PostureFeatures = {
      shoulderRoll: sum.shoulderRoll / n,
      headTilt: sum.headTilt / n,
      forwardCraneRatio: sum.forwardCraneRatio / n,
      neckCollapseRatio: sum.neckCollapseRatio / n
    };

    // Calculate variance (measure of stability)
    let varianceSum = 0;
    for (const sample of this.samples) {
      varianceSum += Math.pow(sample.headTilt - avg.headTilt, 2);
      varianceSum += Math.pow(sample.shoulderRoll - avg.shoulderRoll, 2);
      // Ratios are small, scale them up for variance check
      varianceSum += Math.pow((sample.forwardCraneRatio - avg.forwardCraneRatio) * 100, 2);
      varianceSum += Math.pow((sample.neckCollapseRatio - avg.neckCollapseRatio) * 100, 2);
    }
    const variance = varianceSum / n;

    if (variance > this.maxVariance) {
      this.samples = []; // Reset on failure
      throw new Error("Calibration unstable. Please hold still during calibration.");
    }

    const baseline: PostureBaseline = {
      features: avg,
      timestamp: Date.now()
    };

    this.saveBaseline(baseline);
    return baseline;
  }

  public reset(): void {
    this.samples = [];
  }

  private saveBaseline(baseline: PostureBaseline): void {
    try {
      localStorage.setItem('sonicspine_baseline', JSON.stringify(baseline));
    } catch (e) {
      console.error("Failed to save baseline locally", e);
    }
  }

  public static loadBaseline(): PostureBaseline | null {
    try {
      const data = localStorage.getItem('sonicspine_baseline');
      if (data) {
        return JSON.parse(data) as PostureBaseline;
      }
    } catch (e) {
      console.error("Failed to load baseline", e);
    }
    return null;
  }
}
