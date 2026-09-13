export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
}

export interface PostureLandmarks {
  nose: Point3D;
  leftEar: Point3D;
  rightEar: Point3D;
  leftShoulder: Point3D;
  rightShoulder: Point3D;
  leftHip?: Point3D;
  rightHip?: Point3D;
  leftWrist?: Point3D;
  rightWrist?: Point3D;
  leftIndex?: Point3D;
  rightIndex?: Point3D;
  leftMiddle?: Point3D;
  rightMiddle?: Point3D;
  leftRing?: Point3D;
  rightRing?: Point3D;
  leftPinky?: Point3D;
  rightPinky?: Point3D;
  leftThumb?: Point3D;
  rightThumb?: Point3D;
  leftIndexMCP?: Point3D;
  rightIndexMCP?: Point3D;
  leftMiddleMCP?: Point3D;
  rightMiddleMCP?: Point3D;
  leftRingMCP?: Point3D;
  rightRingMCP?: Point3D;
  leftPinkyMCP?: Point3D;
  rightPinkyMCP?: Point3D;
  leftWristHand?: Point3D;
  rightWristHand?: Point3D;
  leftHandScale?: number;
  rightHandScale?: number;
}

export interface InferenceResult {
  landmarks: PostureLandmarks | null;
  confidence: 'HIGH' | 'LOW' | 'NONE';
  timestamp: number;
}
