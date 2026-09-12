import { PostureLandmarks, Point3D } from './types';

// The callback now provides a continuous normalized volume [0.0 - 1.0]
export type GestureEvent = number;

export class GestureRecognizer {
  private static readonly MIN_CONFIDENCE = 0.6;
  
  // Exponential moving average alpha for smoothing the volume
  private static readonly SMOOTHING_ALPHA = 0.15; 
  
  // Normalized distance thresholds
  private static readonly MIN_NORMALIZED_DIST = 0.05; // Distance for 0% volume
  private static readonly MAX_NORMALIZED_DIST = 0.35; // Distance for 100% volume

  private smoothedVolume: number | null = null;
  private activeHand: 'LEFT' | 'RIGHT' | null = null;
  private onGesture: (event: GestureEvent) => void;

  constructor(onGesture: (event: GestureEvent) => void) {
    this.onGesture = onGesture;
  }

  public process(landmarks: PostureLandmarks | null) {
    if (!landmarks || !landmarks.leftShoulder || !landmarks.rightShoulder) {
      this.reset();
      return;
    }

    // Determine body scale (shoulder width) for normalization
    const shoulderDx = landmarks.leftShoulder.x - landmarks.rightShoulder.x;
    const shoulderDy = landmarks.leftShoulder.y - landmarks.rightShoulder.y;
    const shoulderDz = landmarks.leftShoulder.z - landmarks.rightShoulder.z;
    const bodyScale = Math.sqrt(shoulderDx * shoulderDx + shoulderDy * shoulderDy + shoulderDz * shoulderDz);

    if (bodyScale < 0.01) {
      this.reset();
      return;
    }

    const leftHandValid = this.isHandValid(landmarks.leftIndex, landmarks.leftThumb);
    const rightHandValid = this.isHandValid(landmarks.rightIndex, landmarks.rightThumb);

    if (!leftHandValid && !rightHandValid) {
      // Temporarily hold the last stable volume
      return;
    }

    // Hand consistency: stick to the active hand if it's still valid
    if (this.activeHand === 'LEFT' && !leftHandValid) this.activeHand = null;
    if (this.activeHand === 'RIGHT' && !rightHandValid) this.activeHand = null;

    if (!this.activeHand) {
      if (leftHandValid && rightHandValid) {
        this.activeHand = (landmarks.leftThumb!.visibility > landmarks.rightThumb!.visibility) ? 'LEFT' : 'RIGHT';
      } else if (leftHandValid) {
        this.activeHand = 'LEFT';
      } else {
        this.activeHand = 'RIGHT';
      }
    }

    let activeIndex: Point3D;
    let activeThumb: Point3D;

    if (this.activeHand === 'LEFT') {
      activeIndex = landmarks.leftIndex!;
      activeThumb = landmarks.leftThumb!;
    } else {
      activeIndex = landmarks.rightIndex!;
      activeThumb = landmarks.rightThumb!;
    }

    // Calculate 3D euclidean distance between thumb and index
    const dx = activeIndex.x - activeThumb.x;
    const dy = activeIndex.y - activeThumb.y;
    const dz = activeIndex.z - activeThumb.z;
    const rawDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const normalizedDist = rawDistance / bodyScale;

    // Map the normalized distance to a 0.0 - 1.0 volume range with clamping
    let targetVolume = (normalizedDist - GestureRecognizer.MIN_NORMALIZED_DIST) / (GestureRecognizer.MAX_NORMALIZED_DIST - GestureRecognizer.MIN_NORMALIZED_DIST);
    targetVolume = Math.max(0.0, Math.min(1.0, targetVolume));

    // Smooth the volume transition
    if (this.smoothedVolume === null) {
      this.smoothedVolume = targetVolume;
    } else {
      this.smoothedVolume = this.smoothedVolume + GestureRecognizer.SMOOTHING_ALPHA * (targetVolume - this.smoothedVolume);
    }

    // Dead zone check to prevent micro-jitter callbacks if volume barely changed
    // In practice, web audio handles continuous updates fine, but we can quantize it slightly or just pass it through.
    this.onGesture(this.smoothedVolume);
  }

  private isHandValid(index: Point3D | undefined, thumb: Point3D | undefined): boolean {
    if (!index || !thumb) return false;
    return index.visibility >= GestureRecognizer.MIN_CONFIDENCE && 
           thumb.visibility >= GestureRecognizer.MIN_CONFIDENCE;
  }

  public reset() {
    this.activeHand = null;
    // Keep smoothedVolume as is, so if the hand drops, the volume stays where it was.
    // If we wanted to reset volume, we would do it here, but typically you want the volume 
    // to remain at whatever you left it at when you put your hand down.
  }

  public getState() {
    return 'IDLE'; // Backward compatibility with any diagnostic polling
  }
}
