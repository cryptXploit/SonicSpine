import { FilesetResolver, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export class PoseEngine {
  private poseLandmarker: PoseLandmarker | null = null;
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

      this.isReady = true;
    } catch (error) {
      console.error("Failed to initialize PoseLandmarker:", error);
      throw new Error("Failed to initialize Pose Engine.");
    } finally {
      this.isInitializing = false;
    }
  }

  public detect(videoElement: HTMLVideoElement, timestampMs: number): PoseLandmarkerResult | null {
    if (!this.isReady || !this.poseLandmarker) {
      return null;
    }

    try {
      return this.poseLandmarker.detectForVideo(videoElement, timestampMs);
    } catch (error) {
      console.error("Pose inference error:", error);
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
    this.isReady = false;
  }
}
