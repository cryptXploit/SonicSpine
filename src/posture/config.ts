export const PostureConfig = {
  // Feature Multipliers (Used to calculate total penalty from raw normalized deviations)
  weights: {
    headTilt: 10,
    shoulderRoll: 5,
    crane: 1000,
    collapse: 3500
  },
  
  // Hysteresis & Evidence Accumulation
  evidence: {
    // How fast evidence builds up per frame (based on penalty severity)
    accumulationRate: 1.0,
    // How fast evidence decays when sitting properly
    decayRate: 0.5,
    
    // Thresholds
    driftThreshold: 50,
    correctiveThreshold: 100,
    recoveryThreshold: 20
  },

  // Timeouts
  timeouts: {
    lowConfidenceHoldMs: 5000,
    audioTransitionMs: 1500
  }
};
