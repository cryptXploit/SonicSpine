import { useState, useRef, useEffect } from 'react';
import { CameraView } from './components/CameraView/CameraView';
import { CalibrationEngine, PostureBaseline } from './posture/CalibrationEngine';
import { PostureStateMachine, PostureState } from './posture/PostureStateMachine';
import { TemporalFilter } from './posture/TemporalFilter';
import { AudioEngine } from './audio/AudioEngine';
import { SessionManager, SessionAnalytics } from './analytics/SessionManager';
import { PostureFeatures } from './posture/types';
import { PostureLandmarks } from './vision/types';

function App() {
  const [appState, setAppState] = useState<PostureState>('BOOT');
  const [baseline, setBaseline] = useState<PostureBaseline | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationError, setCalibrationError] = useState<string>('');
  const [sessionSummary, setSessionSummary] = useState<SessionAnalytics | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<CalibrationEngine>(new CalibrationEngine(30));
  const filterRef = useRef<TemporalFilter>(new TemporalFilter(0.2, 3.0, 1.5));
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  const sessionManagerRef = useRef<SessionManager>(new SessionManager());
  
  const stateMachineRef = useRef<PostureStateMachine>(new PostureStateMachine((newState) => {
    setAppState(newState);
    audioEngineRef.current.updateState(newState);
    sessionManagerRef.current.updateState(newState);
  }));

  useEffect(() => {
    const existing = CalibrationEngine.loadBaseline();
    if (existing) {
      setBaseline(existing);
      stateMachineRef.current.triggerCameraReady();
      stateMachineRef.current.startCalibration();
      engineRef.current.addSample(existing.features);
    } else {
      stateMachineRef.current.triggerCameraReady();
    }

    if (audioRef.current) {
      audioEngineRef.current.initialize(audioRef.current);
    }
  }, []);

  const handlePoseUpdate = (_landmarks: PostureLandmarks | null, features: PostureFeatures | null, confidence: 'HIGH' | 'LOW' | 'NONE') => {
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
              audioRef.current?.play().catch(e => console.log("Audio autoplay blocked", e));
              audioEngineRef.current.resumeContext();
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
  };

  const startCalibration = async () => {
    setSessionSummary(null);
    if (audioRef.current) {
      audioEngineRef.current.initialize(audioRef.current);
      await audioEngineRef.current.resumeContext();
      audioRef.current.play().catch(e => console.log(e));
    }

    engineRef.current.reset();
    setCalibrationProgress(0);
    setCalibrationError('');
    stateMachineRef.current.startCalibration();
  };

  const stopSession = () => {
    audioRef.current?.pause();
    const summary = sessionManagerRef.current.endSession();
    if (summary) {
      setSessionSummary(summary);
    }
  };

  const resetCalibration = () => {
    localStorage.removeItem('sonicspine_baseline');
    window.location.reload(); 
  };

  const getStatusText = () => {
    switch (appState) {
      case 'BOOT': return "Starting up...";
      case 'CAMERA_READY': return "Position your camera so your upper body is clearly visible.";
      case 'CALIBRATING': return "Sit in your natural, healthy posture and hold still...";
      case 'READY': return "Ready.";
      case 'GOOD': return "Posture looks great!";
      case 'DRIFTING': return "Slight deviation detected...";
      case 'CORRECTIVE': return "Please sit up straight.";
      case 'RECOVERING': return "Hold it right there...";
      case 'LOW_CONFIDENCE': return "I can't see you clearly. Please move into the frame.";
      case 'ERROR': return "An error occurred.";
      default: return "";
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  };

  if (sessionSummary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
        <div className="w-full max-w-lg bg-white shadow-xl rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-6 text-slate-800">Session Complete</h2>
          <div className="grid grid-cols-2 gap-4 text-left mb-8">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">Health Score</p>
              <p className="text-3xl font-bold text-emerald-500">{sessionSummary.healthScore}%</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">Duration</p>
              <p className="text-2xl font-bold text-slate-700">{formatTime(sessionSummary.totalSessionDurationMs)}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">Good Posture</p>
              <p className="text-xl font-bold text-slate-700">{formatTime(sessionSummary.timeInGoodMs)}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">Corrections</p>
              <p className="text-xl font-bold text-slate-700">{sessionSummary.deviationCount}</p>
            </div>
          </div>
          <button 
            onClick={() => setSessionSummary(null)}
            className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-md transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
      <audio ref={audioRef} loop crossOrigin="anonymous">
        <source src="https://cdn.pixabay.com/download/audio/2022/05/16/audio_9b9e5f39df.mp3?filename=ambient-piano-amp-strings-10711.mp3" type="audio/mpeg" />
      </audio>

      <header className="mb-6 text-center w-full max-w-4xl pt-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">
            SonicSpine
          </h1>
          {baseline && (
            <div className="flex gap-2">
              <button 
                onClick={stopSession}
                className="px-4 py-2 text-sm text-white bg-slate-800 rounded-md shadow hover:bg-slate-700 transition"
              >
                Stop Session
              </button>
              <button 
                onClick={resetCalibration}
                className="px-4 py-2 text-sm text-slate-600 bg-white rounded-md shadow hover:bg-slate-50 transition"
              >
                Recalibrate
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-6 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-700">
              State: {appState}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {getStatusText()}
            </p>
          </div>

          {(appState === 'CAMERA_READY' || appState === 'BOOT') && !baseline && (
            <button 
              onClick={startCalibration}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-md transition whitespace-nowrap"
            >
              Start Calibration
            </button>
          )}

          {appState === 'CALIBRATING' && (
            <div className="w-full md:w-48 bg-slate-200 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-100 ease-out" 
                style={{ width: `${calibrationProgress * 100}%` }}
              />
            </div>
          )}
        </div>

        {calibrationError && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
            {calibrationError}
          </div>
        )}

        <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-inner ring-1 ring-slate-200">
          <CameraView onPoseUpdate={handlePoseUpdate} />
        </div>
      </main>
    </div>
  );
}

export default App;
