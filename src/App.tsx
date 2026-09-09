import { useState, useRef, useEffect } from 'react';
import { CameraView } from './components/CameraView/CameraView';
import { CalibrationEngine, PostureBaseline } from './posture/CalibrationEngine';
import { PostureFeatures } from './posture/types';
import { PostureLandmarks } from './vision/types';

type AppState = 'SETUP' | 'CALIBRATING' | 'ACTIVE';

function App() {
  const [appState, setAppState] = useState<AppState>('SETUP');
  const [_baseline, setBaseline] = useState<PostureBaseline | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationError, setCalibrationError] = useState<string>('');
  
  const engineRef = useRef<CalibrationEngine>(new CalibrationEngine(30)); // 30 frames ~ 1 second at 30fps

  useEffect(() => {
    // Check if baseline already exists
    const existing = CalibrationEngine.loadBaseline();
    if (existing) {
      setBaseline(existing);
      setAppState('ACTIVE');
    }
  }, []);

  const handlePoseUpdate = (_landmarks: PostureLandmarks | null, features: PostureFeatures | null, confidence: 'HIGH' | 'LOW' | 'NONE') => {
    if (appState === 'CALIBRATING') {
      if (confidence === 'HIGH' && features) {
        setCalibrationError('');
        const engine = engineRef.current;
        engine.addSample(features);
        setCalibrationProgress(engine.getProgress());
        
        if (engine.getProgress() >= 1) {
          try {
            const newBaseline = engine.calibrate();
            if (newBaseline) {
              setBaseline(newBaseline);
              setAppState('ACTIVE');
            }
          } catch (e: any) {
            setCalibrationError(e.message);
            setCalibrationProgress(0);
          }
        }
      } else if (confidence === 'LOW') {
        setCalibrationError('Low confidence. Please ensure you are clearly visible.');
      }
    }
  };

  const startCalibration = () => {
    engineRef.current.reset();
    setCalibrationProgress(0);
    setCalibrationError('');
    setAppState('CALIBRATING');
  };

  const resetCalibration = () => {
    localStorage.removeItem('sonicspine_baseline');
    setBaseline(null);
    setAppState('SETUP');
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
      <header className="mb-6 text-center w-full max-w-4xl pt-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">
            SonicSpine
          </h1>
          {appState === 'ACTIVE' && (
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
              {appState === 'SETUP' && "Camera Setup"}
              {appState === 'CALIBRATING' && "Calibration in Progress"}
              {appState === 'ACTIVE' && "Active Session"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {appState === 'SETUP' && "Position your camera so your upper body is clearly visible."}
              {appState === 'CALIBRATING' && "Sit in your natural, healthy posture and hold still..."}
              {appState === 'ACTIVE' && "Baseline set. Monitoring posture..."}
            </p>
          </div>

          {appState === 'SETUP' && (
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
