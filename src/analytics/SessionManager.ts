import { PostureState } from '../posture/PostureStateMachine';

export interface SessionAnalytics {
  totalSessionDurationMs: number;
  timeInGoodMs: number;
  timeInDriftingMs: number;
  timeInCorrectiveMs: number;
  timeInLowConfidenceMs: number;
  deviationCount: number;
  healthScore: number; // 0 to 100
}

export class SessionManager {
  private startTime: number | null = null;
  private lastStateChangeTime: number | null = null;
  private currentState: PostureState | null = null;
  
  private timeInGoodMs = 0;
  private timeInDriftingMs = 0;
  private timeInCorrectiveMs = 0;
  private timeInLowConfidenceMs = 0;
  private deviationCount = 0;

  public startSession(nowMs: number = Date.now()) {
    this.startTime = nowMs;
    this.lastStateChangeTime = nowMs;
    this.currentState = 'READY';
    this.timeInGoodMs = 0;
    this.timeInDriftingMs = 0;
    this.timeInCorrectiveMs = 0;
    this.timeInLowConfidenceMs = 0;
    this.deviationCount = 0;
  }

  public updateState(newState: PostureState, nowMs: number = Date.now()) {
    if (this.startTime === null || this.lastStateChangeTime === null || !this.currentState) return;

    const duration = nowMs - this.lastStateChangeTime;

    // Accumulate time for the PREVIOUS state before switching
    if (this.isGoodState(this.currentState)) {
      this.timeInGoodMs += duration;
    } else if (this.currentState === 'DRIFTING') {
      this.timeInDriftingMs += duration;
    } else if (this.currentState === 'CORRECTIVE') {
      this.timeInCorrectiveMs += duration;
    } else if (this.currentState === 'LOW_CONFIDENCE') {
      this.timeInLowConfidenceMs += duration;
    }

    // Count deviations (only count transitions into DRIFTING from a GOOD state)
    if (newState === 'DRIFTING' && this.isGoodState(this.currentState)) {
      this.deviationCount++;
    }

    this.currentState = newState;
    this.lastStateChangeTime = nowMs;
  }

  public getLiveAnalytics(nowMs: number = Date.now()): SessionAnalytics | null {
    if (this.startTime === null || this.lastStateChangeTime === null || !this.currentState) return null;

    const durationSinceLastState = nowMs - this.lastStateChangeTime;
    
    let tempGood = this.timeInGoodMs;
    let tempDrifting = this.timeInDriftingMs;
    let tempCorrective = this.timeInCorrectiveMs;
    let tempLowConf = this.timeInLowConfidenceMs;

    if (this.isGoodState(this.currentState)) {
      tempGood += durationSinceLastState;
    } else if (this.currentState === 'DRIFTING') {
      tempDrifting += durationSinceLastState;
    } else if (this.currentState === 'CORRECTIVE') {
      tempCorrective += durationSinceLastState;
    } else if (this.currentState === 'LOW_CONFIDENCE') {
      tempLowConf += durationSinceLastState;
    }

    const totalSessionDurationMs = nowMs - this.startTime;
    const totalTrackedMs = tempGood + tempDrifting + tempCorrective;

    let healthScore = 100;
    if (totalTrackedMs > 0) {
      // Good posture is 100%, Drifting is 50%, Corrective is 0%. Low confidence is excluded from the math.
      healthScore = Math.max(0, Math.round(((tempGood + (tempDrifting * 0.5)) / totalTrackedMs) * 100));
    }

    return {
      totalSessionDurationMs,
      timeInGoodMs: tempGood,
      timeInDriftingMs: tempDrifting,
      timeInCorrectiveMs: tempCorrective,
      timeInLowConfidenceMs: tempLowConf,
      deviationCount: this.deviationCount,
      healthScore
    };
  }

  public endSession(nowMs: number = Date.now()): SessionAnalytics | null {
    const finalAnalytics = this.getLiveAnalytics(nowMs);
    
    // Reset internal state
    this.startTime = null;
    this.lastStateChangeTime = null;
    this.currentState = null;

    return finalAnalytics;
  }

  private isGoodState(state: PostureState): boolean {
    return state === 'GOOD' || state === 'READY' || state === 'RECOVERING';
  }
}
