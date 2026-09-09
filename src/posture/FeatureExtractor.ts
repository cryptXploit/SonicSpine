import { PostureLandmarks } from '../vision/types';
import { PostureFeatures } from './types';

export class FeatureExtractor {
  public static extract(landmarks: PostureLandmarks): PostureFeatures {
    // Note: In MediaPipe, left landmarks (e.g., leftEar) represent the user's physical left side.
    // However, when facing the camera, the user's left is on the right side of the image (larger X)
    // unless the image is mirrored. MediaPipe Tasks Vision outputs coordinates in the image space.
    // Assuming un-mirrored raw image space: rightEar has smaller X than leftEar.
    // To calculate angle intuitively (tilt), we go from user's right to user's left.
    // Let's go from rightEar to leftEar.
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

    // Vertical distance from shoulders to nose
    const shoulderMidY = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;
    // Y increases downwards in image space.
    // If the user slouches, the nose gets closer to the shoulders, so the distance decreases.
    // We normalize this by shoulder width to make it distance-independent.
    const neckCollapseRatio = (shoulderMidY - landmarks.nose.y) / shoulderWidth;

    // Forward crane ratio (head size relative to shoulder width)
    const forwardCraneRatio = headSize / shoulderWidth;

    return {
      shoulderRoll,
      headTilt,
      forwardCraneRatio,
      neckCollapseRatio
    };
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
