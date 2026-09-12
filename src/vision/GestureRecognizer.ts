import { PostureLandmarks, Point3D } from './types';

export type GestureEvent = 'VOLUME_UP' | 'VOLUME_DOWN';

export type GestureState = 'IDLE' | 'TRACKING' | 'CONFIRMED' | 'COOLDOWN';

export class GestureRecognizer {
  private static readonly MIN_CONFIDENCE = 0.6; // Both visibility and presence must be decent
  private static readonly MIN_DISPLACEMENT = 0.15; // Requires 15% of screen height movement
  private static readonly TRACKING_FRAMES_REQUIRED = 4; // Must consistently move in same direction for N frames
  private static readonly COOLDOWN_MS = 1000;

  private state: GestureState = 'IDLE';
  private trackingStartY: number | null = null;
  private lastY: number | null = null;
  private trackingFrames = 0;
  private trackingDirection: 'UP' | 'DOWN' | null = null;
  private cooldownEndTime = 0;

  private onGesture: (event: GestureEvent) => void;

  constructor(onGesture: (event: GestureEvent) => void) {
    this.onGesture = onGesture;
  }

  public process(landmarks: PostureLandmarks | null, nowMs: number) {
    if (this.state === 'COOLDOWN') {
      if (nowMs > this.cooldownEndTime) {
        this.reset();
      } else {
        return;
      }
    }

    if (!landmarks) {
      this.reset();
      return;
    }

    // Try to find the most reliable wrist
    const validWrists = [landmarks.leftWrist, landmarks.rightWrist].filter(this.isValidWrist);

    if (validWrists.length === 0) {
      // If we lose tracking during a gesture, reset.
      if (this.state === 'TRACKING') {
        this.reset();
      }
      return;
    }

    // For simplicity, we just track the highest moving wrist (lowest Y)
    const activeWrist = validWrists.reduce((prev, curr) => (curr!.y < prev!.y ? curr : prev))!;
    const currentY = activeWrist.y;

    if (this.state === 'IDLE') {
      // Start tracking
      this.state = 'TRACKING';
      this.trackingStartY = currentY;
      this.lastY = currentY;
      this.trackingFrames = 1;
      this.trackingDirection = null;
      return;
    }

    if (this.state === 'TRACKING') {
      const deltaY = currentY - this.lastY!;
      const totalDisplacement = currentY - this.trackingStartY!;
      
      // Determine instant direction
      const instantDir = deltaY < 0 ? 'UP' : 'DOWN'; // y=0 is top of screen

      // Noise filter / Stationary check: If movement is tiny between frames, they might just be resting or typing
      if (Math.abs(deltaY) < 0.005) {
         // Not moving much this frame, keep tracking but don't count it as a consistent directional move yet.
         // Actually, if they are typing, we might accumulate small movements. 
         // Let's reset if they stay stationary too long, but for now we'll just ignore this frame's direction.
         this.lastY = currentY;
         return;
      }

      if (this.trackingDirection === null) {
        this.trackingDirection = instantDir;
      } else if (this.trackingDirection !== instantDir) {
        // They changed direction (waving, shaking, or returning). Break the gesture.
        this.reset();
        return;
      }

      this.trackingFrames++;
      this.lastY = currentY;

      // Check if we met the criteria for a full gesture
      if (this.trackingFrames >= GestureRecognizer.TRACKING_FRAMES_REQUIRED) {
        if (Math.abs(totalDisplacement) >= GestureRecognizer.MIN_DISPLACEMENT) {
          this.state = 'CONFIRMED';
          this.onGesture(this.trackingDirection === 'UP' ? 'VOLUME_UP' : 'VOLUME_DOWN');
          
          // Enter cooldown
          this.state = 'COOLDOWN';
          this.cooldownEndTime = nowMs + GestureRecognizer.COOLDOWN_MS;
        }
      }
    }
  }

  private isValidWrist(wrist: Point3D | undefined): boolean {
    if (!wrist) return false;
    return wrist.visibility >= GestureRecognizer.MIN_CONFIDENCE && wrist.presence >= GestureRecognizer.MIN_CONFIDENCE;
  }

  public reset() {
    this.state = 'IDLE';
    this.trackingStartY = null;
    this.lastY = null;
    this.trackingFrames = 0;
    this.trackingDirection = null;
  }

  public getState() {
    return this.state;
  }
}
