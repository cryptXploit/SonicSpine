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
    
    // Depth difference: average ear Z minus average shoulder Z
    const avgEarZ = (landmarks.leftEar.z + landmarks.rightEar.z) / 2;
    const avgShoulderZ = (landmarks.leftShoulder.z + landmarks.rightShoulder.z) / 2;
    const neckForwardDepth = avgEarZ - avgShoulderZ;

    // Euclidean distance between shoulders
    const dx = landmarks.leftShoulder.x - landmarks.rightShoulder.x;
    const dy = landmarks.leftShoulder.y - landmarks.rightShoulder.y;
    const shoulderWidth = Math.sqrt(dx * dx + dy * dy);

    return {
      shoulderRoll,
      headTilt,
      neckForwardDepth,
      shoulderWidth
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
