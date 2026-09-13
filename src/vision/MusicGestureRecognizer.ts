import { PostureLandmarks, Point3D } from './types';

export enum MusicAction {
  NEXT = 'NEXT',
  PREVIOUS = 'PREVIOUS',
  PAUSE = 'PAUSE'
}

export enum MusicGestureState {
  IDLE = 'IDLE',
  READY_OPEN = 'READY_OPEN',
  ARMED_FIST = 'ARMED_FIST',
  COOLDOWN = 'COOLDOWN'
}

export class MusicGestureRecognizer {
  private static readonly OPEN_FRAMES = 3;
  private static readonly FIST_FRAMES = 2;
  private static readonly PAUSE_MS = 3000;
  private static readonly COOLDOWN_OPEN_FRAMES = 5; // Need stable open hand to reset

  private state = MusicGestureState.IDLE;
  
  private openCount = 0;
  private fistCount = 0;
  private armedStartTime = 0;
  
  private startX = 0;
  private startY = 0;
  
  private activeHand: 'LEFT' | 'RIGHT' | null = null;
  private onAction: (action: MusicAction) => void;

  public debugInfo = { armedX: 0, currentX: 0, deltaX: 0, intent: '' };

  constructor(onAction: (action: MusicAction) => void) {
    this.onAction = onAction;
  }

  public process(landmarks: PostureLandmarks | null, timestampMs: number) {
    if (!landmarks) {
      this.reset();
      return;
    }

    const leftValid = this.isHandValid(landmarks.leftIndex, landmarks.leftWristHand, landmarks.leftHandScale);
    const rightValid = this.isHandValid(landmarks.rightIndex, landmarks.rightWristHand, landmarks.rightHandScale);

    if (!leftValid && !rightValid) {
      this.reset();
      return;
    }

    if (this.activeHand === 'LEFT' && !leftValid) this.reset();
    if (this.activeHand === 'RIGHT' && !rightValid) this.reset();

    if (!this.activeHand) {
      this.activeHand = leftValid ? 'LEFT' : 'RIGHT';
    }

    let wrist: Point3D;
    let indexTip: Point3D, indexMcp: Point3D;
    let middleTip: Point3D, middleMcp: Point3D;
    let ringTip: Point3D, ringMcp: Point3D;
    let pinkyTip: Point3D, pinkyMcp: Point3D;
    let scale: number;
    
    if (this.activeHand === 'LEFT') {
      wrist = landmarks.leftWristHand!;
      indexTip = landmarks.leftIndex!; indexMcp = landmarks.leftIndexMCP!;
      middleTip = landmarks.leftMiddle!; middleMcp = landmarks.leftMiddleMCP!;
      ringTip = landmarks.leftRing!; ringMcp = landmarks.leftRingMCP!;
      pinkyTip = landmarks.leftPinky!; pinkyMcp = landmarks.leftPinkyMCP!;
      scale = landmarks.leftHandScale!;
    } else {
      wrist = landmarks.rightWristHand!;
      indexTip = landmarks.rightIndex!; indexMcp = landmarks.rightIndexMCP!;
      middleTip = landmarks.rightMiddle!; middleMcp = landmarks.rightMiddleMCP!;
      ringTip = landmarks.rightRing!; ringMcp = landmarks.rightRingMCP!;
      pinkyTip = landmarks.rightPinky!; pinkyMcp = landmarks.rightPinkyMCP!;
      scale = landmarks.rightHandScale!;
    }

    const dist2D = (p1: Point3D, p2: Point3D) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
    
    // Geometric approach: Ratio of (Wrist -> Tip) over (Wrist -> MCP)
    const getRatio = (tip: Point3D, mcp: Point3D) => {
      const dTip = dist2D(wrist, tip);
      const dMcp = dist2D(wrist, mcp);
      return dMcp > 0.001 ? dTip / dMcp : 1.0;
    };

    const rIndex = getRatio(indexTip, indexMcp);
    const rMiddle = getRatio(middleTip, middleMcp);
    const rRing = getRatio(ringTip, ringMcp);
    const rPinky = getRatio(pinkyTip, pinkyMcp);

    const isOpen = rIndex > 1.3 && rMiddle > 1.3 && rRing > 1.3 && rPinky > 1.3;
    const isFist = rIndex < 1.1 && rMiddle < 1.1 && rRing < 1.1 && rPinky < 1.1;

    // Track state machine
    switch (this.state) {
      case MusicGestureState.IDLE:
        this.debugInfo.intent = 'IDLE';
        this.debugInfo.deltaX = 0;
        if (isOpen) {
          this.openCount++;
          if (this.openCount >= MusicGestureRecognizer.OPEN_FRAMES) {
            this.state = MusicGestureState.READY_OPEN;
            this.fistCount = 0;
          }
        } else {
          this.openCount = 0;
        }
        break;

      case MusicGestureState.READY_OPEN:
        this.debugInfo.intent = 'WAITING_FOR_FIST';
        if (isFist) {
          this.fistCount++;
          if (this.fistCount >= MusicGestureRecognizer.FIST_FRAMES) {
            this.state = MusicGestureState.ARMED_FIST;
            this.armedStartTime = timestampMs;
            this.startX = wrist.x;
            this.startY = wrist.y;
            this.debugInfo.armedX = this.startX;
          }
        } else if (!isOpen) {
          // Stay ready but allow timeout if hand completely gone
        }
        break;

      case MusicGestureState.ARMED_FIST:
        if (!isFist) {
          this.reset();
          break;
        }

        const deltaX = (wrist.x - this.startX) / scale;
        const deltaY = (wrist.y - this.startY) / scale;
        
        this.debugInfo.currentX = wrist.x;
        this.debugInfo.deltaX = deltaX;

        // Cancel if moving mostly vertically by a large margin (drift immunity)
        if (Math.abs(deltaY) > 2.0) {
          this.reset();
          break;
        }

        const isHorizontalDominant = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
        this.debugInfo.intent = isHorizontalDominant 
          ? (deltaX < 0 ? 'RIGHT' : 'LEFT') 
          : 'VERTICAL_OR_STILL';

        // Fast responsive swipe: smaller intentional movement (0.5 scale = half a palm width)
        if (Math.abs(deltaX) > 0.5 && isHorizontalDominant) {
          if (deltaX < -0.5) {
            this.onAction(MusicAction.NEXT); // Physical Right -> Next
          } else if (deltaX > 0.5) {
            this.onAction(MusicAction.PREVIOUS); // Physical Left -> Prev
          }
          this.enterCooldown();
          break;
        }

        // Hold for Pause (Using Real Time)
        if (timestampMs - this.armedStartTime >= MusicGestureRecognizer.PAUSE_MS) {
          this.onAction(MusicAction.PAUSE);
          this.enterCooldown();
          break;
        }
        break;

      case MusicGestureState.COOLDOWN:
        this.debugInfo.intent = 'COOLDOWN';
        if (isOpen) {
          this.openCount++;
          if (this.openCount >= MusicGestureRecognizer.COOLDOWN_OPEN_FRAMES) {
            this.state = MusicGestureState.READY_OPEN;
            this.fistCount = 0;
          }
        } else {
          this.openCount = 0;
        }
        break;
    }
  }

  private isHandValid(index: Point3D | undefined, wrist: Point3D | undefined, scale: number | undefined): boolean {
    return !!index && !!wrist && !!scale && scale > 0.01;
  }

  public reset() {
    this.state = MusicGestureState.IDLE;
    this.activeHand = null;
    this.openCount = 0;
    this.fistCount = 0;
    this.armedStartTime = 0;
    this.debugInfo = { armedX: 0, currentX: 0, deltaX: 0, intent: 'RESET' };
  }
  
  private enterCooldown() {
    this.state = MusicGestureState.COOLDOWN;
    this.openCount = 0;
    this.debugInfo.intent = 'COOLDOWN';
  }

  public getState() {
    return this.state;
  }
}
