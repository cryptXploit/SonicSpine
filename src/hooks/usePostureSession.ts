import { useState, useRef, useCallback, useEffect } from 'react';
import { CalibrationEngine, PostureBaseline } from '../posture/CalibrationEngine';
import { PostureStateMachine, PostureState } from '../posture/PostureStateMachine';
import { TemporalFilter } from '../posture/TemporalFilter';
import { SessionManager, SessionAnalytics } from '../analytics/SessionManager';
import { AudioEngine } from '../audio/AudioEngine';
import { PostureFeatures } from '../posture/types';
import { PostureLandmarks } from '../vision/types';

export function usePostureSession() {
  const [appState, setAppState] = useState<PostureState>('BOOT');
  const [baseline, setBaseline] = useState<PostureBaseline | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationError, setCalibrationError] = useState<string>('');
  const [sessionSummary, setSessionSummary] = useState<SessionAnalytics | null>(null);

  const engineRef = useRef<CalibrationEngine>(new CalibrationEngine(30, 200));
  const filterRef = useRef<TemporalFilter>(new TemporalFilter(0.2, 3.0, 1.5));
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  const sessionManagerRef = useRef<SessionManager>(new SessionManager());

  const stateMachineRef = useRef<PostureStateMachine>(new PostureStateMachine((newState) => {
    setAppState(newState);
    audioEngineRef.current.updateState(newState);
    sessionManagerRef.current.updateState(newState);
  }));

  useEffect(() => {
    // Deterministic Audio Initialization on mount
    audioEngineRef.current.initialize();
    audioEngineRef.current.load();

    const existing = CalibrationEngine.loadBaseline();
    if (existing) {
      setBaseline(existing);
      stateMachineRef.current.triggerCameraReady();
      stateMachineRef.current.startCalibration();
      engineRef.current.addSample(existing.features);
    } else {
      stateMachineRef.current.triggerCameraReady();
    }

    return () => {
      audioEngineRef.current.dispose();
    }
  }, []);

  const handlePoseUpdate = useCallback((
    _landmarks: PostureLandmarks | null, 
    features: PostureFeatures | null, 
    confidence: 'HIGH' | 'LOW' | 'NONE'
  ) => {
    const sm = stateMachineRef.current;
    const currentState = sm.getState();

    if (currentState === 'CALIBRATING') {
      if (confidence === 'HIGH' && features) {
        setCalibrationError('');
        engineRef.current.addSample(features);
        setCalibrationProgress(engineRef.current.getProgress());
        
        if (engineRef.current.getProgress() >= 1) {
          try {
            const newBaseline = engineRef.current.calibrate();
            if (newBaseline) {
              setBaseline(newBaseline);
              sm.finishCalibration();
              sessionManagerRef.current.startSession();
            }
          } catch (e: any) {
            setCalibrationError(e.message);
            setCalibrationProgress(0);
          }
        }
      } else if (confidence === 'LOW') {
        setCalibrationError('Low confidence. Please ensure you are clearly visible.');
      }
      return;
    }

    if (baseline && features && confidence === 'HIGH') {
      const { isInstantlyOutOfBounds, isSustainedDeviation, isSustainedRecovery } = 
        filterRef.current.process(features, baseline, performance.now());
      
      sm.processFrame({
        confidence,
        isInstantlyOutOfBounds,
        isSustainedDeviation,
        isSustainedRecovery
      });
    } else {
      sm.processFrame({
        confidence: confidence,
        isInstantlyOutOfBounds: false,
        isSustainedDeviation: false,
        isSustainedRecovery: false
      });
    }
  }, [baseline]);

  const startCalibration = useCallback(async () => {
    setSessionSummary(null);
    engineRef.current.reset();
    setCalibrationProgress(0);
    setCalibrationError('');
    
    // Play MUST be called synchronously in the user gesture!
    audioEngineRef.current.play();

    stateMachineRef.current.startCalibration();
  }, []);

  const stopSession = useCallback(() => {
    audioEngineRef.current.pause();
    const summary = sessionManagerRef.current.endSession();
    if (summary) {
      setSessionSummary(summary);
    }
    return summary;
  }, []);

  const resetCalibration = useCallback(() => {
    audioEngineRef.current.pause();
    localStorage.removeItem('sonicspine_baseline');
    setBaseline(null);
    setCalibrationProgress(0);
    engineRef.current.reset();
    stateMachineRef.current.triggerCameraReady();
  }, []);

  const clearSummary = useCallback(() => {
    setSessionSummary(null);
  }, []);

  return {
    appState,
    baseline,
    calibrationProgress,
    calibrationError,
    sessionSummary,
    audioEngine: audioEngineRef.current,
    handlePoseUpdate,
    startCalibration,
    stopSession,
    resetCalibration,
    clearSummary
  };
}
