import { PostureLandmarks } from './types';

export class ConfidenceEstimator {
  private static readonly VISIBILITY_THRESHOLD = 0.65;

  public static evaluate(landmarks: PostureLandmarks | null): 'HIGH' | 'LOW' | 'NONE' {
    if (!landmarks) {
      return 'NONE';
    }

    // Evaluate core landmarks needed for posture (ears and shoulders)
    const requiredPoints = [
      landmarks.leftEar,
      landmarks.rightEar,
      landmarks.leftShoulder,
      landmarks.rightShoulder
    ];

    // Count how many required points are clearly visible
    const visiblePoints = requiredPoints.filter(p => p.visibility >= this.VISIBILITY_THRESHOLD);

    // If we can't see the shoulders or ears properly, we lack confidence
    if (visiblePoints.length < requiredPoints.length) {
      return 'LOW';
    }

    return 'HIGH';
  }
}
