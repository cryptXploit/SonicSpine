import { useState, useRef, useCallback, useEffect } from 'react';
import { CalibrationEngine, PostureBaseline } from '../posture/CalibrationEngine';
import { PostureStateMachine, PostureState } from '../posture/PostureStateMachine';
import { TemporalFilter } from '../posture/TemporalFilter';
import { SessionManager, SessionAnalytics } from '../analytics/SessionManager';
import { AudioEngine } from '../audio/AudioEngine';
import { PostureFeatures } from '../posture/types';
import { PostureLandmarks } from '../vision/types';
import { GestureRecognizer } from '../vision/GestureRecognizer';
import { SettingsManager } from '../settings/SettingsManager';

export function usePostureSession() {
  const [appState, setAppState] = useState<PostureState>('BOOT');
  const [baseline, setBaseline] = useState<PostureBaseline | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationError, setCalibrationError] = useState<string>('');
  const [sessionSummary, setSessionSummary] = useState<SessionAnalytics | null>(null);
  const [volume, setVolume] = useState(1.0);

  const [setupChecklist, setSetupChecklist] = useState({ head: false, shoulders: false });

  const engineRef = useRef<CalibrationEngine>(new CalibrationEngine(30, 200));
  const filterRef = useRef<TemporalFilter>(new TemporalFilter(0.2));
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  const sessionManagerRef = useRef<SessionManager>(new SessionManager());
  const checklistRef = useRef({ head: false, shoulders: false });
  
  const gestureRecognizerRef = useRef<GestureRecognizer>(new GestureRecognizer((volume) => {
    // Volume is already smoothed and clamped 0.0 - 1.0
    audioEngineRef.current.setVolume(volume);
    setVolume(volume); // Sync with React UI
  }));

  // Diagnostic refs (avoiding state to prevent thrashing)
  const lastDiagnosticConfidence = useRef<import('../vision/ConfidenceEstimator').ConfidenceResult | null>(null);
  const lastDiagnosticFeatures = useRef<PostureFeatures | null>(null);
  const lastDiagnosticDeviations = useRef<import('../posture/TemporalFilter').PostureDeviations | null>(null);
  const lastDiagnosticMotion = useRef<number>(1.0);
  const lastDiagnosticFlags = useRef({ isDrifting: false, isCorrective: false, isRecovered: false });
  const lastDiagnosticEvidence = useRef<number>(0);

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
    landmarks: PostureLandmarks | null, 
    features: PostureFeatures | null, 
    confidence: import('../vision/ConfidenceEstimator').ConfidenceResult
  ) => {
    const sm = stateMachineRef.current;
    const currentState = sm.getState();
    const settings = SettingsManager.getSettings();

    if (settings.enableGestures) {
      gestureRecognizerRef.current.process(landmarks);
    } else {
      gestureRecognizerRef.current.reset();
    }

    if (currentState === 'CAMERA_READY') {
      const newHead = confidence.details?.headVisible || false;
      const newShoulders = confidence.details?.shouldersVisible || false;
      
      if (newHead !== checklistRef.current.head || newShoulders !== checklistRef.current.shoulders) {
        checklistRef.current = { head: newHead, shoulders: newShoulders };
        setSetupChecklist(checklistRef.current);
      }
    }

    if (currentState === 'CALIBRATING') {
      if (confidence.level === 'HIGH' && features) {
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
      } else if (confidence.level === 'LOW') {
        setCalibrationError('Low confidence. Please ensure you are clearly visible.');
      }
      return;
    }

    if (baseline && features && confidence.level === 'HIGH') {
      const { stateFlags, deviations, motionStability, evidence } = filterRef.current.process(features, baseline, performance.now());
      
      lastDiagnosticConfidence.current = confidence;
      lastDiagnosticFeatures.current = features;
      lastDiagnosticDeviations.current = deviations;
      lastDiagnosticMotion.current = motionStability;
      lastDiagnosticFlags.current = stateFlags;
      lastDiagnosticEvidence.current = evidence;

      sm.processFrame({
        confidence,
        stateFlags
      });
    } else {
      lastDiagnosticConfidence.current = confidence;
      lastDiagnosticFeatures.current = features;
      lastDiagnosticDeviations.current = null;
      lastDiagnosticMotion.current = 1.0;
      lastDiagnosticFlags.current = { isDrifting: false, isCorrective: false, isRecovered: false };
      
      // Evidence doesn't reset instantly, it decays if not high confidence, but we can just hold it
      
      sm.processFrame({
        confidence,
        stateFlags: lastDiagnosticFlags.current
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

  const handleManualVolume = useCallback((vol: number) => {
    audioEngineRef.current.setVolume(vol);
    setVolume(vol);
  }, []);

  return {
    appState,
    baseline,
    calibrationProgress,
    calibrationError,
    sessionSummary,
    volume,
    setupChecklist,
    handleManualVolume,
    audioEngine: audioEngineRef.current,
    handlePoseUpdate,
    startCalibration,
    stopSession,
    resetCalibration,
    clearSummary,
    getDiagnostics: () => ({
      state: stateMachineRef.current.getState(),
      confidence: lastDiagnosticConfidence.current,
      features: lastDiagnosticFeatures.current,
      deviations: lastDiagnosticDeviations.current,
      motionStability: lastDiagnosticMotion.current,
      stateFlags: lastDiagnosticFlags.current,
      evidence: lastDiagnosticEvidence.current,
      audio: audioEngineRef.current.getDiagnostics()
    })
  };
}
