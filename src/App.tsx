import { useRef, useState, useEffect } from 'react';
import { CameraView } from './components/CameraView/CameraView';
import { db } from './storage/Database';
import { Dashboard } from './components/Dashboard/Dashboard';
import { usePostureSession } from './hooks/usePostureSession';

function App() {
  const {
    appState,
    baseline,
    calibrationProgress,
    calibrationError,
    sessionSummary,
    handlePoseUpdate,
    startCalibration,
    stopSession,
    resetCalibration,
    initializeAudio,
    clearSummary
  } = usePostureSession();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);

  useEffect(() => {
    if (audioRef.current) {
      initializeAudio(audioRef.current);
    }
  }, [initializeAudio]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleStartSession = async () => {
    // 1. Initialize calibration/session logic
    await startCalibration();
    
    // 2. Play audio immediately on user interaction to satisfy browser autoplay policies
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Audio playback failed. Please interact with the page.", err);
      }
    }
  };

  const handleStopSession = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    const summary = stopSession();
    if (summary) {
      try {
        await db.saveSession(summary);
      } catch (e) {
        console.error("Failed to save session to DB", e);
      }
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error(e));
      }
    }
  };

  const handleResetCalibration = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    resetCalibration();
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
              <p className="text-sm text-slate-500 mb-1">Consistency Score</p>
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
            onClick={clearSummary}
            className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-md transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-100 p-4 font-sans text-slate-800 pb-20">
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
                onClick={handleStopSession}
                className="px-4 py-2 text-sm text-white bg-slate-800 rounded-md shadow hover:bg-slate-700 transition"
              >
                Stop Session
              </button>
              <button 
                onClick={handleResetCalibration}
                className="px-4 py-2 text-sm text-slate-600 bg-white rounded-md shadow hover:bg-slate-50 transition"
              >
                Recalibrate
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-6 flex flex-col gap-6">
        
        {/* Posture Status Area */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                appState === 'GOOD' ? 'bg-emerald-500' :
                appState === 'DRIFTING' ? 'bg-amber-400' :
                appState === 'CORRECTIVE' ? 'bg-red-500' :
                appState === 'RECOVERING' ? 'bg-emerald-300' :
                appState === 'LOW_CONFIDENCE' ? 'bg-slate-400' :
                'bg-slate-300'
              }`} />
              State: {appState}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {getStatusText()}
            </p>
          </div>

          {(appState === 'CAMERA_READY' || appState === 'BOOT') && !baseline && (
            <button 
              onClick={handleStartSession}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-md transition whitespace-nowrap"
            >
              Calibrate & Start
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

        {/* Central Audio Control Area */}
        {baseline && (
          <div className="flex items-center justify-between p-4 bg-slate-800 text-white rounded-xl shadow-inner">
            <div className="flex flex-col">
              <p className="text-sm text-slate-300 uppercase tracking-wider font-semibold">Music Controls</p>
              <p className="text-xs text-slate-400 mt-1">Ambient Focus</p>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleAudio}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 transition"
                aria-label={isPlaying ? "Pause music" : "Play music"}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                ) : (
                  <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              
              <div className="hidden sm:flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9m-9.5-6H5a2 2 0 00-2 2v2a2 2 0 002 2h3.5l4.5 4.5v-15L8.45 10.05z" /></svg>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-24 accent-emerald-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Camera Area */}
        <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-inner ring-1 ring-slate-200">
          <CameraView onPoseUpdate={handlePoseUpdate} />
        </div>
      </main>

      {!baseline && <Dashboard />}
    </div>
  );
}

export default App;
