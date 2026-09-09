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
      neckForwardDepth: acc.neckForwardDepth + curr.neckForwardDepth,
      shoulderWidth: acc.shoulderWidth + curr.shoulderWidth
    }), { shoulderRoll: 0, headTilt: 0, neckForwardDepth: 0, shoulderWidth: 0 });

    const n = this.samples.length;
    const avg: PostureFeatures = {
      shoulderRoll: sum.shoulderRoll / n,
      headTilt: sum.headTilt / n,
      neckForwardDepth: sum.neckForwardDepth / n,
      shoulderWidth: sum.shoulderWidth / n
    };

    // Calculate variance (measure of stability)
    let varianceSum = 0;
    for (const sample of this.samples) {
      varianceSum += Math.pow(sample.headTilt - avg.headTilt, 2);
      varianceSum += Math.pow(sample.shoulderRoll - avg.shoulderRoll, 2);
      // depth variance is tiny, so we scale it up to be comparable to degrees, or ignore it
      varianceSum += Math.pow((sample.neckForwardDepth - avg.neckForwardDepth) * 100, 2);
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
