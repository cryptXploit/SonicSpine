import { PoseLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Point3D, PostureLandmarks } from './types';

// MediaPipe Pose Landmark constants
const LM = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
};

export class LandmarkProcessor {
  public static process(result: PoseLandmarkerResult | null): PostureLandmarks | null {
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      return null;
    }

    const landmarks = result.landmarks[0];
    
    // Ensure all required landmarks exist
    if (landmarks.length <= Math.max(LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER)) {
      return null;
    }

    const toPoint3D = (lm: NormalizedLandmark): Point3D => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 0,
      // presence is technically available in full landmark objects but tasks-vision NormalizedLandmark typing often maps presence into visibility or omits it.
      presence: (lm as any).presence ?? lm.visibility ?? 0,
    });

    const postureLandmarks: PostureLandmarks = {
      nose: toPoint3D(landmarks[LM.NOSE]),
      leftEar: toPoint3D(landmarks[LM.LEFT_EAR]),
      rightEar: toPoint3D(landmarks[LM.RIGHT_EAR]),
      leftShoulder: toPoint3D(landmarks[LM.LEFT_SHOULDER]),
      rightShoulder: toPoint3D(landmarks[LM.RIGHT_SHOULDER]),
    };

    if (landmarks.length > Math.max(LM.LEFT_HIP, LM.RIGHT_HIP)) {
      postureLandmarks.leftHip = toPoint3D(landmarks[LM.LEFT_HIP]);
      postureLandmarks.rightHip = toPoint3D(landmarks[LM.RIGHT_HIP]);
    }

    if (landmarks.length > Math.max(LM.LEFT_WRIST, LM.RIGHT_WRIST)) {
      postureLandmarks.leftWrist = toPoint3D(landmarks[LM.LEFT_WRIST]);
      postureLandmarks.rightWrist = toPoint3D(landmarks[LM.RIGHT_WRIST]);
    }

    return postureLandmarks;
  }
}
