import { useState, useRef, useEffect } from 'react';
import { CameraView } from './components/CameraView/CameraView';
import { CalibrationEngine, PostureBaseline } from './posture/CalibrationEngine';
import { PostureStateMachine, PostureState } from './posture/PostureStateMachine';
import { TemporalFilter } from './posture/TemporalFilter';
import { AudioEngine } from './audio/AudioEngine';
import { PostureFeatures } from './posture/types';
import { PostureLandmarks } from './vision/types';

function App() {
  const [appState, setAppState] = useState<PostureState>('BOOT');
  const [baseline, setBaseline] = useState<PostureBaseline | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationError, setCalibrationError] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<CalibrationEngine>(new CalibrationEngine(30));
  const filterRef = useRef<TemporalFilter>(new TemporalFilter(0.2, 3.0, 1.5));
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  
  const stateMachineRef = useRef<PostureStateMachine>(new PostureStateMachine((newState) => {
    setAppState(newState);
    audioEngineRef.current.updateState(newState);
  }));

  useEffect(() => {
    const existing = CalibrationEngine.loadBaseline();
    if (existing) {
      setBaseline(existing);
      stateMachineRef.current.triggerCameraReady();
      stateMachineRef.current.startCalibration();
      // Wait, we bypass calibration if it exists:
      engineRef.current.addSample(existing.features); // dummy fill
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

    // 1. Handle Calibration
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
              // Try to auto-play audio on successful calibration
              audioRef.current?.play().catch(e => console.log("Audio autoplay blocked", e));
              audioEngineRef.current.resumeContext();
            }
          } catch (e: any) {
            setCalibrationError(e.message);
            setCalibrationProgress(0);
          }
        }
      } else if (confidence === 'LOW') {
        setCalibrationError('Low confidence. Please ensure you are clearly visible.');
      }
      return; // Stop here if calibrating
    }

    // 2. Handle Active Session via Temporal Filter and State Machine
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
    // Requires user interaction to play audio properly
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

  const resetCalibration = () => {
    localStorage.removeItem('sonicspine_baseline');
    setBaseline(null);
    engineRef.current.reset();
    filterRef.current.reset();
    
    // Hard reset SM to SETUP logic by creating a new one or manually tweaking. 
    // For MVP, we can just reload or handle it purely:
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

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
      {/* Hidden Audio Source (We can place any ambient audio here later) */}
      <audio ref={audioRef} loop crossOrigin="anonymous">
        <source src="https://cdn.pixabay.com/download/audio/2022/05/16/audio_9b9e5f39df.mp3?filename=ambient-piano-amp-strings-10711.mp3" type="audio/mpeg" />
      </audio>

      <header className="mb-6 text-center w-full max-w-4xl pt-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">
            SonicSpine
          </h1>
          {baseline && (
            <button 
              onClick={resetCalibration}
              className="px-4 py-2 text-sm text-slate-600 bg-white rounded-md shadow hover:bg-slate-50 transition"
            >
              Recalibrate
            </button>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-6 flex flex-col gap-6">
        
        {/* Status Banner */}
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
