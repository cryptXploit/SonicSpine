import { PostureLandmarks, Point3D } from './types';

export type GestureEvent = number;

export class GestureRecognizer {
  private static readonly SMOOTHING_ALPHA = 0.15; 
  private static readonly MIN_NORMALIZED_DIST = 0.15; // 0% volume
  private static readonly MAX_NORMALIZED_DIST = 1.2;  // 100% volume
  private static readonly DEADBAND = 0.015;
  
  private static readonly PINCH_ARM_THRESHOLD = 0.5; 
  private static readonly INDEX_EXTENDED_THRESHOLD = 0.6;
  
  private static readonly ACTIVATION_FRAMES = 5;
  private static readonly DEACTIVATION_TIMEOUT = 10;

  private smoothedVolume: number | null = null;
  private activeHand: 'LEFT' | 'RIGHT' | null = null;
  
  private isGestureActive = false;
  private activeFrameCount = 0;
  private missingHandFrames = 0;

  private onGesture: (event: GestureEvent) => void;

  constructor(onGesture: (event: GestureEvent) => void) {
    this.onGesture = onGesture;
  }

  public process(landmarks: PostureLandmarks | null) {
    if (!landmarks) {
      this.handleMissingHand();
      return;
    }

    const leftHandValid = this.isHandValid(landmarks.leftIndex, landmarks.leftThumb, landmarks.leftIndexMCP, landmarks.leftHandScale);
    const rightHandValid = this.isHandValid(landmarks.rightIndex, landmarks.rightThumb, landmarks.rightIndexMCP, landmarks.rightHandScale);

    if (!leftHandValid && !rightHandValid) {
      this.handleMissingHand();
      return;
    }

    if (this.activeHand === 'LEFT' && !leftHandValid) {
        this.activeHand = null;
    }
    if (this.activeHand === 'RIGHT' && !rightHandValid) {
        this.activeHand = null;
    }

    if (!this.activeHand) {
      this.activeHand = leftHandValid ? 'LEFT' : 'RIGHT';
      // Reset state machine on hand switch
      this.isGestureActive = false;
      this.activeFrameCount = 0;
      this.missingHandFrames = 0;
    }

    let indexTip: Point3D;
    let thumbTip: Point3D;
    let indexMCP: Point3D;
    let handScale: number;

    if (this.activeHand === 'LEFT') {
      indexTip = landmarks.leftIndex!;
      thumbTip = landmarks.leftThumb!;
      indexMCP = landmarks.leftIndexMCP!;
      handScale = landmarks.leftHandScale!;
    } else {
      indexTip = landmarks.rightIndex!;
      thumbTip = landmarks.rightThumb!;
      indexMCP = landmarks.rightIndexMCP!;
      handScale = landmarks.rightHandScale!;
    }

    // 1. Calculate relative geometry
    const tipDx = indexTip.x - thumbTip.x;
    const tipDy = indexTip.y - thumbTip.y;
    const pinchDist = Math.sqrt(tipDx * tipDx + tipDy * tipDy) / handScale;

    const extDx = indexTip.x - indexMCP.x;
    const extDy = indexTip.y - indexMCP.y;
    const indexExtension = Math.sqrt(extDx * extDx + extDy * extDy) / handScale;

    // 2. State Machine (Two-Phase Model)
    if (!this.isGestureActive) {
      // PHASE 1: ARMING
      const isIndexExtended = indexExtension > GestureRecognizer.INDEX_EXTENDED_THRESHOLD;
      const isPinchGrab = pinchDist <= GestureRecognizer.PINCH_ARM_THRESHOLD;

      if (isIndexExtended && isPinchGrab) {
        this.activeFrameCount++;
        if (this.activeFrameCount >= GestureRecognizer.ACTIVATION_FRAMES) {
          this.isGestureActive = true;
          this.missingHandFrames = 0;
        }
      } else {
        this.activeFrameCount = 0;
      }
    } else {
      // PHASE 2: TRACKING
      // Once armed, do NOT deactivate unless hand is lost.
      this.missingHandFrames = 0; 
    }

    // 3. Output volume ONLY if active
    if (this.isGestureActive) {
      let targetVolume = (pinchDist - GestureRecognizer.MIN_NORMALIZED_DIST) / (GestureRecognizer.MAX_NORMALIZED_DIST - GestureRecognizer.MIN_NORMALIZED_DIST);
      targetVolume = Math.max(0.0, Math.min(1.0, targetVolume));

      if (this.smoothedVolume === null) {
        this.smoothedVolume = targetVolume;
        this.onGesture(this.smoothedVolume);
      } else {
        const diff = targetVolume - this.smoothedVolume;
        if (Math.abs(diff) > GestureRecognizer.DEADBAND || targetVolume <= 0.001 || targetVolume >= 0.999) {
          this.smoothedVolume = this.smoothedVolume + GestureRecognizer.SMOOTHING_ALPHA * diff;
          this.onGesture(this.smoothedVolume);
        }
      }
    }
  }

  private handleMissingHand() {
    this.missingHandFrames++;
    if (this.missingHandFrames >= GestureRecognizer.DEACTIVATION_TIMEOUT) {
      this.isGestureActive = false;
      this.activeFrameCount = 0;
      this.activeHand = null;
    }
  }

  private isHandValid(index: Point3D | undefined, thumb: Point3D | undefined, mcp: Point3D | undefined, scale: number | undefined): boolean {
    return !!index && !!thumb && !!mcp && !!scale && scale > 0.01;
  }

  public reset() {
    this.activeHand = null;
    this.handleMissingHand();
  }

  public getState() {
    return this.isGestureActive ? 'ACTIVE' : 'IDLE';
  }
}
