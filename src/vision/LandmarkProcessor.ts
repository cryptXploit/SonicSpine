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
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_TIP: 20
};

export class LandmarkProcessor {
  public static process(result: VisionResult | null): PostureLandmarks | null {
    if (!result || !result.pose || !result.pose.landmarks || result.pose.landmarks.length === 0) {
      return null;
    }

    const poseLandmarks = result.pose.landmarks[0];
    
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
      for (let i = 0; i < result.hands.landmarks.length; i++) {
        const handLandmarks = result.hands.landmarks[i];
        
        let handedness = 'Left'; // Default fallback
        if (result.hands.handednesses && result.hands.handednesses[i] && result.hands.handednesses[i].length > 0) {
          handedness = result.hands.handednesses[i][0].categoryName; // Usually "Left" or "Right"
        }

        if (handLandmarks.length > Math.max(HLM.THUMB_TIP, HLM.INDEX_TIP, HLM.INDEX_MCP, HLM.MIDDLE_MCP, HLM.RING_MCP, HLM.PINKY_MCP, HLM.MIDDLE_TIP, HLM.RING_TIP, HLM.PINKY_TIP, HLM.WRIST)) {
          // Verify valid numbers exist
          const indexLm = handLandmarks[HLM.INDEX_TIP];
          const thumbLm = handLandmarks[HLM.THUMB_TIP];
          const idxMcpLm = handLandmarks[HLM.INDEX_MCP];
          const midMcpLm = handLandmarks[HLM.MIDDLE_MCP];
          const ringMcpLm = handLandmarks[HLM.RING_MCP];
          const pkyMcpLm = handLandmarks[HLM.PINKY_MCP];
          const middleLm = handLandmarks[HLM.MIDDLE_TIP];
          const ringLm = handLandmarks[HLM.RING_TIP];
          const pinkyLm = handLandmarks[HLM.PINKY_TIP];
          const wristLm = handLandmarks[HLM.WRIST];

          if (
            Number.isFinite(indexLm.x) && Number.isFinite(indexLm.y) &&
            Number.isFinite(thumbLm.x) && Number.isFinite(thumbLm.y) &&
            Number.isFinite(idxMcpLm.x) && Number.isFinite(idxMcpLm.y) &&
            Number.isFinite(midMcpLm.x) && Number.isFinite(midMcpLm.y) &&
            Number.isFinite(ringMcpLm.x) && Number.isFinite(ringMcpLm.y) &&
            Number.isFinite(pkyMcpLm.x) && Number.isFinite(pkyMcpLm.y) &&
            Number.isFinite(middleLm.x) && Number.isFinite(middleLm.y) &&
            Number.isFinite(ringLm.x) && Number.isFinite(ringLm.y) &&
            Number.isFinite(pinkyLm.x) && Number.isFinite(pinkyLm.y) &&
            Number.isFinite(wristLm.x) && Number.isFinite(wristLm.y)
          ) {
            const indexTipPt = toPoint3D(indexLm);
            const thumbTipPt = toPoint3D(thumbLm);
            const indexMcpPt = toPoint3D(idxMcpLm);
            const middleMcpPt = toPoint3D(midMcpLm);
            const ringMcpPt = toPoint3D(ringMcpLm);
            const pinkyMcpPt = toPoint3D(pkyMcpLm);
            const middleTipPt = toPoint3D(middleLm);
            const ringTipPt = toPoint3D(ringLm);
            const pinkyTipPt = toPoint3D(pinkyLm);
            const wristHandPt = toPoint3D(wristLm);
            
            // Calculate a stable hand scale reference (Index MCP to Pinky MCP)
            const dx = idxMcpLm.x - pkyMcpLm.x;
            const dy = idxMcpLm.y - pkyMcpLm.y;
            const handScale = Math.max(0.01, Math.sqrt(dx * dx + dy * dy)); // Avoid div-by-zero

            if (handedness === 'Left') {
              postureLandmarks.leftIndex = indexTipPt;
              postureLandmarks.leftThumb = thumbTipPt;
              postureLandmarks.leftIndexMCP = indexMcpPt;
              postureLandmarks.leftMiddleMCP = middleMcpPt;
              postureLandmarks.leftRingMCP = ringMcpPt;
              postureLandmarks.leftPinkyMCP = pinkyMcpPt;
              postureLandmarks.leftMiddle = middleTipPt;
              postureLandmarks.leftRing = ringTipPt;
              postureLandmarks.leftPinky = pinkyTipPt;
              postureLandmarks.leftWristHand = wristHandPt;
              postureLandmarks.leftHandScale = handScale;
            } else {
              postureLandmarks.rightIndex = indexTipPt;
              postureLandmarks.rightThumb = thumbTipPt;
              postureLandmarks.rightIndexMCP = indexMcpPt;
              postureLandmarks.rightMiddleMCP = middleMcpPt;
              postureLandmarks.rightRingMCP = ringMcpPt;
              postureLandmarks.rightPinkyMCP = pinkyMcpPt;
              postureLandmarks.rightMiddle = middleTipPt;
              postureLandmarks.rightRing = ringTipPt;
              postureLandmarks.rightPinky = pinkyTipPt;
              postureLandmarks.rightWristHand = wristHandPt;
              postureLandmarks.rightHandScale = handScale;
            }
          }
        }
      }
    }

    return postureLandmarks;
  }
}
