import { ConfidenceResult } from '../vision/ConfidenceEstimator';
import { PostureConfig } from './config';
import { SettingsManager } from '../settings/SettingsManager';

export type PostureState =
  | 'BOOT'
  | 'CAMERA_READY'
  | 'CALIBRATING'
  | 'READY'
  | 'GOOD'
  | 'DRIFTING'
  | 'CORRECTIVE'
  | 'RECOVERING'
  | 'LOW_CONFIDENCE'
  | 'ERROR';

export interface StateContext {
  confidence: ConfidenceResult;
  stateFlags: {
    isDrifting: boolean;
    isCorrective: boolean;
    isRecovered: boolean;
  };
}

export class PostureStateMachine {
  private currentState: PostureState = 'BOOT';
  private onStateChange?: (newState: PostureState) => void;
  
  private lowConfidenceStartTime: number | null = null;
  private absenceStartTime: number | null = null;
  private recoveryStartTime: number | null = null;

  constructor(onStateChange?: (newState: PostureState) => void) {
    this.onStateChange = onStateChange;
  }

  public getState(): PostureState {
    return this.currentState;
  }

  public triggerCameraReady() {
    if (this.currentState === 'BOOT' || this.currentState === 'ERROR') {
      this.transitionTo('CAMERA_READY');
    }
  }

  public triggerError() {
    this.transitionTo('ERROR');
  }

  public startCalibration() {
    if (this.currentState === 'CAMERA_READY' || this.currentState === 'READY' || this.isActiveSession(this.currentState)) {
      this.transitionTo('CALIBRATING');
    }
  }

  public finishCalibration() {
    if (this.currentState === 'CALIBRATING') {
      this.transitionTo('READY');
      this.transitionTo('GOOD');
    }
  }

  public processFrame(ctx: StateContext, nowMs?: number) {
    if (!this.isActiveSession(this.currentState) && this.currentState !== 'LOW_CONFIDENCE') {
      return; 
    }

    const now = nowMs ?? performance.now();
    const settings = SettingsManager.getSettings();

    // 1. Handle Confidence Gating (Absence vs Low Tracking)
    if (ctx.confidence.level === 'NONE') {
      this.lowConfidenceStartTime = null; // Clear LOW tracking timer

      if (this.currentState !== 'LOW_CONFIDENCE') {
        if (this.absenceStartTime === null) {
          this.absenceStartTime = now;
        } else if (now - this.absenceStartTime > settings.screenPresenceGracePeriodMs) {
          this.transitionTo('LOW_CONFIDENCE');
        }
      }
      return; // Do NOT process posture features while completely absent
    } else {
      this.absenceStartTime = null;
    }

    if (ctx.confidence.level === 'LOW') {
      if (this.currentState !== 'LOW_CONFIDENCE') {
        if (this.lowConfidenceStartTime === null) {
          this.lowConfidenceStartTime = now;
        } else if (now - this.lowConfidenceStartTime > PostureConfig.timeouts.lowConfidenceHoldMs) {
          this.transitionTo('LOW_CONFIDENCE');
        }
      }
      return; // Do NOT process posture features while tracking is low
    } else {
      this.lowConfidenceStartTime = null;
    }

    // 2. Recovery from LOW_CONFIDENCE
    if (this.currentState === 'LOW_CONFIDENCE' && ctx.confidence.level === 'HIGH') {
      // Clear timers
      this.absenceStartTime = null;
      this.lowConfidenceStartTime = null;
      
      // Re-evaluate based on current flags
      if (ctx.stateFlags.isCorrective) {
        this.transitionTo('CORRECTIVE');
      } else if (ctx.stateFlags.isDrifting) {
        this.transitionTo('DRIFTING');
      } else {
        this.transitionTo('GOOD');
      }
      return;
    }

    // 3. Process Normal State Transitions
    switch (this.currentState) {
      case 'GOOD':
        if (ctx.stateFlags.isCorrective) {
          this.transitionTo('CORRECTIVE');
        } else if (ctx.stateFlags.isDrifting) {
          this.transitionTo('DRIFTING');
        }
        break;

      case 'DRIFTING':
        if (ctx.stateFlags.isRecovered) {
          this.transitionTo('GOOD');
        } else if (ctx.stateFlags.isCorrective) {
          this.transitionTo('CORRECTIVE');
        }
        break;

      case 'CORRECTIVE':
        if (ctx.stateFlags.isRecovered) {
          this.transitionTo('RECOVERING');
        } else if (!ctx.stateFlags.isCorrective && !ctx.stateFlags.isDrifting) {
          // If we immediately lost the corrective signal but aren't fully recovered yet
          this.transitionTo('RECOVERING');
        }
        break;

      case 'RECOVERING':
        if (ctx.stateFlags.isCorrective) {
          this.recoveryStartTime = null;
          this.transitionTo('CORRECTIVE');
        } else if (ctx.stateFlags.isDrifting) {
          this.recoveryStartTime = null;
          this.transitionTo('DRIFTING');
        } else if (ctx.stateFlags.isRecovered) {
          if (this.recoveryStartTime === null) {
            this.recoveryStartTime = now;
          }
          if (now - this.recoveryStartTime >= settings.recoveryDelayMs) {
            this.recoveryStartTime = null;
            this.transitionTo('GOOD');
          }
        } else {
          // If we somehow lost isRecovered without hitting drifting/corrective flags
          this.recoveryStartTime = null;
        }
        break;
    }
  }

  private isActiveSession(state: PostureState) {
    return ['GOOD', 'DRIFTING', 'CORRECTIVE', 'RECOVERING'].includes(state);
  }

  private transitionTo(newState: PostureState) {
    if (this.currentState !== newState) {
      this.currentState = newState;
      if (this.onStateChange) {
        this.onStateChange(newState);
      }
    }
  }
}
