import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Point3D, PostureLandmarks } from './types';
import { VisionResult } from './PoseEngine';

// MediaPipe Pose Landmark constants
const LM = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
};

// Hand Landmark constants
const HLM = {
  THUMB_TIP: 4,
  INDEX_TIP: 8
};

export class LandmarkProcessor {
  public static process(result: VisionResult | null): PostureLandmarks | null {
    if (!result || !result.pose || !result.pose.landmarks || result.pose.landmarks.length === 0) {
      return null;
    }

    const poseLandmarks = result.pose.landmarks[0];
    
    // Ensure all required pose landmarks exist
    if (poseLandmarks.length <= Math.max(LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER)) {
      return null;
    }

    const toPoint3D = (lm: NormalizedLandmark): Point3D => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 1.0,
      presence: (lm as any).presence ?? lm.visibility ?? 1.0,
    });

    const postureLandmarks: PostureLandmarks = {
      nose: toPoint3D(poseLandmarks[LM.NOSE]),
      leftEar: toPoint3D(poseLandmarks[LM.LEFT_EAR]),
      rightEar: toPoint3D(poseLandmarks[LM.RIGHT_EAR]),
      leftShoulder: toPoint3D(poseLandmarks[LM.LEFT_SHOULDER]),
      rightShoulder: toPoint3D(poseLandmarks[LM.RIGHT_SHOULDER]),
    };

    if (poseLandmarks.length > Math.max(LM.LEFT_HIP, LM.RIGHT_HIP)) {
      postureLandmarks.leftHip = toPoint3D(poseLandmarks[LM.LEFT_HIP]);
      postureLandmarks.rightHip = toPoint3D(poseLandmarks[LM.RIGHT_HIP]);
    }

    if (poseLandmarks.length > Math.max(LM.LEFT_WRIST, LM.RIGHT_WRIST)) {
      postureLandmarks.leftWrist = toPoint3D(poseLandmarks[LM.LEFT_WRIST]);
      postureLandmarks.rightWrist = toPoint3D(poseLandmarks[LM.RIGHT_WRIST]);
    }

    // Now extract genuine finger landmarks from HandLandmarker if available
    if (result.hands && result.hands.landmarks && result.hands.landmarks.length > 0) {
      // Hands might be left or right. We can check handedness or just use the first hand.
      // For volume control, we just grab whichever hand is visible and map it to a generic 'index' and 'thumb'.
      // We will map it to `leftIndex` and `leftThumb` for convenience, GestureRecognizer checks both anyway.
      
      const handLandmarks = result.hands.landmarks[0];
      const handedness = result.hands.handedness[0][0].categoryName; // "Left" or "Right"

      if (handLandmarks.length > Math.max(HLM.THUMB_TIP, HLM.INDEX_TIP)) {
        if (handedness === 'Left') {
          postureLandmarks.leftIndex = toPoint3D(handLandmarks[HLM.INDEX_TIP]);
          postureLandmarks.leftThumb = toPoint3D(handLandmarks[HLM.THUMB_TIP]);
        } else {
          postureLandmarks.rightIndex = toPoint3D(handLandmarks[HLM.INDEX_TIP]);
          postureLandmarks.rightThumb = toPoint3D(handLandmarks[HLM.THUMB_TIP]);
        }
      }
    }

    return postureLandmarks;
  }
}
