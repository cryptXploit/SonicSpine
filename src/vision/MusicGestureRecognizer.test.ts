import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicGestureRecognizer, MusicAction, MusicGestureState } from './MusicGestureRecognizer';
import { PostureLandmarks, Point3D } from './types';

describe('MusicGestureRecognizer', () => {
  let recognizer: MusicGestureRecognizer;
  let onAction: (action: MusicAction) => void;
  let currentTime = 0;

  beforeEach(() => {
    onAction = vi.fn();
    recognizer = new MusicGestureRecognizer(onAction);
    currentTime = 0;
  });

  const createPt = (x: number, y: number): Point3D => ({
    x, y, z: 0, visibility: 1.0, presence: 1.0
  });

  // Helper to create hand
  const createHand = (
    isOpen: boolean,
    offsetX: number = 0,
    offsetY: number = 0,
    scale: number = 0.1
  ): PostureLandmarks => {
    const wrist = [0.5 + offsetX, 0.5 + offsetY];
    
    // Scale = 0.1
    // If Open, ratio > 1.3
    // If Fist, ratio < 1.1
    
    // MCP distance from wrist (palm length)
    const mcpDist = 0.1; 
    
    // Tip distance from wrist
    const tipDist = isOpen ? 0.2 : 0.08; 
    // Open ratio = 0.2 / 0.1 = 2.0 (> 1.3)
    // Fist ratio = 0.08 / 0.1 = 0.8 (< 1.1)

    return {
      nose: createPt(0, 0), leftEar: createPt(0, 0), rightEar: createPt(0, 0),
      leftShoulder: createPt(0, 0), rightShoulder: createPt(0, 0),
      leftWristHand: createPt(wrist[0], wrist[1]),
      
      leftIndex: createPt(wrist[0], wrist[1] - tipDist),
      leftIndexMCP: createPt(wrist[0], wrist[1] - mcpDist),
      
      leftMiddle: createPt(wrist[0], wrist[1] - tipDist),
      leftMiddleMCP: createPt(wrist[0], wrist[1] - mcpDist),
      
      leftRing: createPt(wrist[0], wrist[1] - tipDist),
      leftRingMCP: createPt(wrist[0], wrist[1] - mcpDist),
      
      leftPinky: createPt(wrist[0], wrist[1] - tipDist),
      leftPinkyMCP: createPt(wrist[0], wrist[1] - mcpDist),
      
      leftThumb: createPt(wrist[0] - 0.05, wrist[1] - tipDist),
      leftHandScale: scale
    };
  };

  const processFrames = (lms: PostureLandmarks | null, count: number, stepMs = 33) => {
    for (let i = 0; i < count; i++) {
      recognizer.process(lms, currentTime);
      currentTime += stepMs;
    }
  };

  it('A. Open hand alone -> NO ACTION', () => {
    processFrames(createHand(true), 20);
    expect(recognizer.getState()).toBe(MusicGestureState.READY_OPEN);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('C. Fist appearing without open-hand preparation -> NO ACTION', () => {
    processFrames(createHand(false), 20);
    expect(recognizer.getState()).toBe(MusicGestureState.IDLE);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('F. Open -> close -> meaningful right movement -> NEXT exactly once', () => {
    processFrames(createHand(true), 5); // Ready
    processFrames(createHand(false), 5); // Armed
    expect(recognizer.getState()).toBe(MusicGestureState.ARMED_FIST);
    
    // Move right -> deltaX < 0
    processFrames(createHand(false, -0.2, 0), 1); 
    expect(onAction).toHaveBeenCalledWith(MusicAction.NEXT);
    expect(recognizer.getState()).toBe(MusicGestureState.COOLDOWN);
    
    // Move more right -> NO ACTION (since cooldown)
    processFrames(createHand(false, -0.4, 0), 1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('H. Open -> close -> meaningful left movement -> PREVIOUS exactly once', () => {
    processFrames(createHand(true), 5);
    processFrames(createHand(false), 5);
    
    // Move left -> deltaX > 0
    processFrames(createHand(false, 0.2, 0), 1); 
    expect(onAction).toHaveBeenCalledWith(MusicAction.PREVIOUS);
    expect(recognizer.getState()).toBe(MusicGestureState.COOLDOWN);
  });

  it('I. Open -> close -> vertical movement only -> NO ACTION (and resets)', () => {
    processFrames(createHand(true), 5);
    processFrames(createHand(false), 5);
    
    // Move down > 2.0 scales (2.5 * 0.1 = 0.25)
    processFrames(createHand(false, 0, 0.3), 1); 
    expect(onAction).not.toHaveBeenCalled();
    expect(recognizer.getState()).toBe(MusicGestureState.IDLE); // Reset due to drift
  });

  it('L1. Open -> close -> stable fist for 2999ms -> NO PAUSE', () => {
    processFrames(createHand(true), 5);
    processFrames(createHand(false), 1); // Almost armed
    
    // Arm exactly now
    const armTime = currentTime;
    processFrames(createHand(false), 1); 
    expect(recognizer.getState()).toBe(MusicGestureState.ARMED_FIST);
    
    // Jump time to 2999ms after arm
    currentTime = armTime + 2999;
    recognizer.process(createHand(false), currentTime);
    
    expect(onAction).not.toHaveBeenCalledWith(MusicAction.PAUSE);
    expect(recognizer.getState()).toBe(MusicGestureState.ARMED_FIST);
  });

  it('L2. Open -> close -> stable fist for 3000ms -> PAUSE', () => {
    processFrames(createHand(true), 5);
    processFrames(createHand(false), 1); // Almost armed
    
    const armTime = currentTime;
    processFrames(createHand(false), 1); 
    
    // Jump time to 3000ms after arm
    currentTime = armTime + 3000;
    recognizer.process(createHand(false), currentTime);
    
    expect(onAction).toHaveBeenCalledWith(MusicAction.PAUSE);
    expect(recognizer.getState()).toBe(MusicGestureState.COOLDOWN);
  });

  it('L3. Open -> close -> fist breaks before 3000ms -> NO PAUSE', () => {
    processFrames(createHand(true), 5);
    processFrames(createHand(false), 2); // Armed
    
    // Jump 1500ms
    currentTime += 1500;
    recognizer.process(createHand(false), currentTime);
    
    // Fist breaks!
    currentTime += 100;
    recognizer.process(createHand(true), currentTime);
    expect(recognizer.getState()).toBe(MusicGestureState.IDLE); // Resets
    
    // Jump past original 3000ms point
    currentTime += 2000;
    recognizer.process(createHand(false), currentTime); // Back to fist? Too late, state reset
    
    expect(onAction).not.toHaveBeenCalledWith(MusicAction.PAUSE);
  });

  it('M. Open -> close -> move right before 3s -> NEXT, NOT PAUSE', () => {
    processFrames(createHand(true), 5);
    processFrames(createHand(false), 2); // Armed
    
    // Move right -> deltaX < 0
    currentTime += 1000;
    recognizer.process(createHand(false, -0.2, 0), currentTime); 
    
    expect(onAction).toHaveBeenCalledWith(MusicAction.NEXT);
    expect(onAction).not.toHaveBeenCalledWith(MusicAction.PAUSE);
  });

  it('Q. Reset to open hand -> ready for a new action', () => {
    processFrames(createHand(true), 5);
    processFrames(createHand(false), 5);
    processFrames(createHand(false, -0.2, 0), 1); // NEXT
    expect(onAction).toHaveBeenCalledTimes(1);

    // Cooldown -> requires Open hand for 5 frames
    processFrames(createHand(true, -0.2, 0), 5);
    expect(recognizer.getState()).toBe(MusicGestureState.READY_OPEN);

    // Can fire again
    processFrames(createHand(false, -0.2, 0), 5);
    processFrames(createHand(false, -0.4, 0), 1); // NEXT
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it('R. Hand disappears mid-gesture -> cancel safely', () => {
    processFrames(createHand(true), 5);
    expect(recognizer.getState()).toBe(MusicGestureState.READY_OPEN);
    
    processFrames(null, 1);
    expect(recognizer.getState()).toBe(MusicGestureState.IDLE);
  });
});
