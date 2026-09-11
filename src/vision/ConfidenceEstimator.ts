import { PostureLandmarks } from './types';

export interface ConfidenceResult {
  level: 'HIGH' | 'LOW' | 'NONE';
  score: number; // 0.0 to 1.0
}

export class ConfidenceEstimator {
  private static readonly VISIBILITY_THRESHOLD = 0.5;

  public static evaluate(landmarks: PostureLandmarks | null): ConfidenceResult {
    if (!landmarks) {
      return { level: 'NONE', score: 0 };
    }

    // Evaluate core landmarks needed for posture
    const requiredPoints = [
      landmarks.leftEar,
      landmarks.rightEar,
      landmarks.leftShoulder,
      landmarks.rightShoulder
    ];

    // Calculate average visibility
    const totalVisibility = requiredPoints.reduce((sum, p) => sum + (p.visibility || 0), 0);
    const avgVisibility = totalVisibility / requiredPoints.length;

    // Calculate how many points pass the minimum threshold
    const visibleCount = requiredPoints.filter(p => (p.visibility || 0) >= this.VISIBILITY_THRESHOLD).length;
    
    // Score heavily weights having all points visible, but smoothly degrades.
    // If we can't see at least 3 points, confidence is effectively 0.
    let score = 0;
    if (visibleCount === 4) {
      score = avgVisibility; 
    } else if (visibleCount === 3) {
      score = avgVisibility * 0.5; 
    } else {
      score = 0;
    }

    // Map to levels for the State Machine
    let level: 'HIGH' | 'LOW' | 'NONE' = 'NONE';
    if (score >= 0.7) {
      level = 'HIGH';
    } else if (score > 0) {
      level = 'LOW';
    }

    return { level, score };
  }
}
