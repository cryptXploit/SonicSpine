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
  leftThumb?: Point3D;
  rightThumb?: Point3D;
}

export interface InferenceResult {
  landmarks: PostureLandmarks | null;
  confidence: 'HIGH' | 'LOW' | 'NONE';
  timestamp: number;
}
