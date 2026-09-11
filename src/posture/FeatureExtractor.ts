import { PostureLandmarks } from '../vision/types';
import { PostureFeatures } from './types';

export class FeatureExtractor {
  public static extract(landmarks: PostureLandmarks): PostureFeatures {
    const headTilt = this.calculateAngle(landmarks.rightEar, landmarks.leftEar);
    const shoulderRoll = this.calculateAngle(landmarks.rightShoulder, landmarks.leftShoulder);
    
    // Distance between shoulders
    const shoulderDx = landmarks.leftShoulder.x - landmarks.rightShoulder.x;
    const shoulderDy = landmarks.leftShoulder.y - landmarks.rightShoulder.y;
    const shoulderWidth = Math.sqrt(shoulderDx * shoulderDx + shoulderDy * shoulderDy);

    // Head size (ear to ear)
    const headDx = landmarks.leftEar.x - landmarks.rightEar.x;
    const headDy = landmarks.leftEar.y - landmarks.rightEar.y;
    const headSize = Math.sqrt(headDx * headDx + headDy * headDy);

    // Vertical distance from shoulders to EARS (not nose, to avoid false positives when looking down)
    const shoulderMidY = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;
    const earMidY = (landmarks.leftEar.y + landmarks.rightEar.y) / 2;
    
    // Slouch / Tech Neck Ratio: How high the ears are above the shoulders, normalized by shoulder width.
    const neckCollapseRatio = (shoulderMidY - earMidY) / shoulderWidth;

    // Face Yaw: If the user turns their head, the nose moves horizontally relative to the ears.
    // We can compute the midpoint of the ears and see how far the nose is from it.
    const earMidX = (landmarks.leftEar.x + landmarks.rightEar.x) / 2;
    const noseYawDeviation = Math.abs(landmarks.nose.x - earMidX) / headSize;
    // When nose is perfectly between ears (facing forward), noseYawDeviation is ~0.
    // When facing sideways, nose moves to the edge, making it ~0.5 or larger.

    // Forward crane ratio (head size relative to shoulder width)
    const forwardCraneRatio = headSize / shoulderWidth;

    return {
      shoulderRoll,
      headTilt,
      forwardCraneRatio,
      neckCollapseRatio,
      noseYawDeviation
    } as PostureFeatures & { noseYawDeviation: number };
  }

  /**
   * Calculates angle in degrees relative to horizontal line.
   * Expected input: p1 is structurally right side (smaller X in non-mirrored image), 
   * p2 is structurally left side (larger X).
   */
  private static calculateAngle(p1: {x: number, y: number}, p2: {x: number, y: number}): number {
    const dy = p2.y - p1.y;
    const dx = p2.x - p1.x;
    
    // Math.atan2 returns values from -PI to PI
    let angleDegrees = Math.atan2(dy, dx) * (180 / Math.PI);
    
    return angleDegrees;
  }
}
