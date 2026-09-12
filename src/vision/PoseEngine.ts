import { FilesetResolver, PoseLandmarker, PoseLandmarkerResult, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export interface VisionResult {
  pose: PoseLandmarkerResult | null;
  hands: HandLandmarkerResult | null;
}

export class PoseEngine {
  private poseLandmarker: PoseLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing = false;
  private isReady = false;

  public async initialize(): Promise<void> {
    if (this.isReady || this.isInitializing) return;
    this.isInitializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isReady = true;
    } catch (error) {
      console.error("Failed to initialize Vision Engines:", error);
      throw new Error("Failed to initialize Vision Engine.");
    } finally {
      this.isInitializing = false;
    }
  }

  public detect(videoElement: HTMLVideoElement, timestampMs: number): VisionResult | null {
    if (!this.isReady || !this.poseLandmarker || !this.handLandmarker) {
      return null;
    }

    try {
      const pose = this.poseLandmarker.detectForVideo(videoElement, timestampMs);
      const hands = this.handLandmarker.detectForVideo(videoElement, timestampMs);
      return { pose, hands };
    } catch (error) {
      console.error("Vision inference error:", error);
      return null;
    }
  }

  public get isModelReady() {
    return this.isReady;
  }

  public close() {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    this.isReady = false;
  }
}
