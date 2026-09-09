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
  confidence: 'HIGH' | 'LOW' | 'NONE';
  isInstantlyOutOfBounds: boolean;
  isSustainedDeviation: boolean;
  isSustainedRecovery: boolean;
}

export class PostureStateMachine {
  private currentState: PostureState = 'BOOT';
  private onStateChange?: (newState: PostureState) => void;

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
      // Typically transitioning to READY, and then automatically to GOOD to start tracking
      this.transitionTo('READY');
      this.transitionTo('GOOD');
    }
  }

  public processFrame(ctx: StateContext) {
    if (!this.isActiveSession(this.currentState) && this.currentState !== 'LOW_CONFIDENCE') {
      return; 
    }

    if (ctx.confidence === 'LOW' || ctx.confidence === 'NONE') {
      if (this.currentState !== 'LOW_CONFIDENCE') {
        this.transitionTo('LOW_CONFIDENCE');
      }
      return;
    }

    if (this.currentState === 'LOW_CONFIDENCE' && ctx.confidence === 'HIGH') {
      // Re-evaluate immediately based on current geometry
      if (ctx.isInstantlyOutOfBounds) {
        this.transitionTo(ctx.isSustainedDeviation ? 'CORRECTIVE' : 'DRIFTING');
      } else {
        this.transitionTo('GOOD');
      }
      return;
    }

    switch (this.currentState) {
      case 'GOOD':
        if (ctx.isInstantlyOutOfBounds) {
          this.transitionTo('DRIFTING');
        }
        break;

      case 'DRIFTING':
        if (!ctx.isInstantlyOutOfBounds) {
          this.transitionTo('GOOD');
        } else if (ctx.isSustainedDeviation) {
          this.transitionTo('CORRECTIVE');
        }
        break;

      case 'CORRECTIVE':
        if (!ctx.isInstantlyOutOfBounds) {
          this.transitionTo('RECOVERING');
        }
        break;

      case 'RECOVERING':
        if (ctx.isInstantlyOutOfBounds) {
          this.transitionTo('CORRECTIVE');
        } else if (ctx.isSustainedRecovery) {
          this.transitionTo('GOOD');
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
