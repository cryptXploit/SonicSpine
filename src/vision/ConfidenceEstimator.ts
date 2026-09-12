import { PostureLandmarks } from './types';

export interface ConfidenceResult {
  level: 'HIGH' | 'LOW' | 'NONE';
  score: number; // 0.0 to 1.0
  details: {
    headVisible: boolean;
    shouldersVisible: boolean;
  };
}

export class ConfidenceEstimator {
  private static readonly VISIBILITY_THRESHOLD = 0.5;

  public static evaluate(landmarks: PostureLandmarks | null): ConfidenceResult {
    if (!landmarks) {
      return { level: 'NONE', score: 0, details: { headVisible: false, shouldersVisible: false } };
    }

    const headVisible = 
      (landmarks.leftEar.visibility || 0) >= this.VISIBILITY_THRESHOLD || 
      (landmarks.rightEar.visibility || 0) >= this.VISIBILITY_THRESHOLD;

    const shouldersVisible = 
      (landmarks.leftShoulder.visibility || 0) >= this.VISIBILITY_THRESHOLD && 
      (landmarks.rightShoulder.visibility || 0) >= this.VISIBILITY_THRESHOLD;

    const requiredPoints = [
      landmarks.leftEar,
      landmarks.rightEar,
      landmarks.leftShoulder,
      landmarks.rightShoulder
    ];

    const totalVisibility = requiredPoints.reduce((sum, p) => sum + (p.visibility || 0), 0);
    const avgVisibility = totalVisibility / requiredPoints.length;
    const visibleCount = requiredPoints.filter(p => (p.visibility || 0) >= this.VISIBILITY_THRESHOLD).length;
    
    let score = 0;
    if (visibleCount >= 3) {
      score = avgVisibility; 
    }

    let level: 'HIGH' | 'LOW' | 'NONE' = 'NONE';
    if (score >= 0.7 && headVisible && shouldersVisible) {
      level = 'HIGH';
    } else if (score > 0 || headVisible || shouldersVisible) {
      level = 'LOW';
    }

    return { level, score, details: { headVisible, shouldersVisible } };
  }
}
