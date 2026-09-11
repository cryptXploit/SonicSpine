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
    // 1. Play audio immediately on user interaction to satisfy browser autoplay policies
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Audio playback failed. Please interact with the page.", err);
      }
    }
    
    // 2. Initialize calibration/session logic
    await startCalibration();
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

  const getStatusSubtext = () => {
    switch (appState) {
      case 'BOOT': return "Starting engine...";
      case 'CAMERA_READY': return "Position your upper body clearly in the frame.";
      case 'CALIBRATING': return "Hold your natural posture still...";
      case 'READY': return "Ready.";
      case 'GOOD': return "You're in your calibrated posture.";
      case 'DRIFTING': return "Your posture is moving away from baseline.";
      case 'CORRECTIVE': return "Return to your calibrated position.";
      case 'RECOVERING': return "Smoothly restoring your baseline.";
      case 'LOW_CONFIDENCE': return "Move back into the frame.";
      case 'ERROR': return "Camera error.";
      default: return "";
    }
  };

  const getStatusColor = () => {
    switch (appState) {
      case 'GOOD': return 'text-emerald-500';
      case 'DRIFTING': return 'text-amber-500';
      case 'CORRECTIVE': return 'text-rose-500';
      case 'RECOVERING': return 'text-emerald-400';
      case 'LOW_CONFIDENCE': return 'text-slate-400';
      default: return 'text-slate-700';
    }
  };

  const getBorderColor = () => {
    switch (appState) {
      case 'GOOD': return 'border-emerald-500/50 shadow-emerald-500/20';
      case 'DRIFTING': return 'border-amber-500/50 shadow-amber-500/20';
      case 'CORRECTIVE': return 'border-rose-500/50 shadow-rose-500/20';
      case 'RECOVERING': return 'border-emerald-400/50 shadow-emerald-400/20';
      default: return 'border-slate-200 shadow-slate-200/50';
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  };

  const renderContent = () => {
    if (sessionSummary) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
          <div className="w-full max-w-sm bg-white shadow-2xl rounded-[2rem] p-8 text-center border border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-800">Session Complete</h2>
            <p className="text-slate-500 mb-8 text-sm">Great job staying focused.</p>
            
            <div className="grid grid-cols-2 gap-4 text-left mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Consistency</p>
                <p className="text-3xl font-bold text-emerald-500">{sessionSummary.healthScore}%</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</p>
                <p className="text-2xl font-bold text-slate-700">{formatTime(sessionSummary.totalSessionDurationMs)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">In Zone</p>
                <p className="text-xl font-bold text-slate-700">{formatTime(sessionSummary.timeInGoodMs)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Drifts</p>
                <p className="text-xl font-bold text-slate-700">{sessionSummary.deviationCount}</p>
              </div>
            </div>
            <button 
              onClick={clearSummary}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-lg transition active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      );
    }

    if (!baseline) {
      return (
        <div className="flex flex-col items-center min-h-screen bg-slate-50 p-4 sm:p-6 font-sans text-slate-800 pb-24">
          <header className="w-full max-w-md mt-4 mb-8 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              SONICSPINE
            </h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">Good posture starts with your baseline.</p>
          </header>

          <main className="w-full max-w-md flex flex-col gap-6">
            <div className="bg-white p-4 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
              
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 relative">
                <CameraView onPoseUpdate={handlePoseUpdate} />
                
                {/* Calibration Overlay */}
                {appState === 'CALIBRATING' && (
                  <div className="absolute inset-0 z-20 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin mb-4"></div>
                    <p className="text-white font-medium mb-4">{getStatusSubtext()}</p>
                    <div className="w-full max-w-[200px] bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-100 ease-out" 
                        style={{ width: `${calibrationProgress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-4">
                {calibrationError ? (
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium text-center">
                    {calibrationError}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">{appState === 'CAMERA_READY' ? 'Camera Ready' : appState}</p>
                    <p className="text-xs text-slate-500 mt-1">{getStatusSubtext()}</p>
                  </div>
                )}

                <button 
                  onClick={handleStartSession}
                  disabled={appState === 'BOOT' || appState === 'CALIBRATING'}
                  className="w-full py-4 bg-emerald-500 disabled:bg-slate-300 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition active:scale-[0.98]"
                >
                  Calibrate & Start Session
                </button>
              </div>
            </div>

            <Dashboard />
          </main>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center min-h-screen bg-slate-50 p-4 sm:p-6 font-sans text-slate-800">
        <header className="w-full max-w-md mt-4 mb-6 flex justify-between items-center px-2">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          SONICSPINE
        </h1>
        <button 
          onClick={handleStopSession}
          className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition active:scale-[0.95]"
        >
          End Session
        </button>
      </header>

      <main className="w-full max-w-md flex flex-col gap-6 flex-1">
        
        {/* Posture Status Hero */}
        <div className={`bg-white p-8 rounded-[2rem] shadow-2xl transition-all duration-700 border-2 ${getBorderColor()} flex flex-col items-center text-center relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
            <div className={`h-full transition-all duration-1000 ${
              appState === 'GOOD' ? 'w-full bg-emerald-500' : 
              appState === 'DRIFTING' ? 'w-2/3 bg-amber-500' : 
              appState === 'CORRECTIVE' ? 'w-1/3 bg-rose-500' : 
              'w-full bg-slate-300'
            }`} />
          </div>

          <h2 className={`text-4xl font-black mt-4 mb-2 tracking-tight transition-colors duration-500 ${getStatusColor()}`}>
            {appState}
          </h2>
          <p className="text-slate-500 font-medium">{getStatusSubtext()}</p>
          
          <div className="w-32 h-32 mt-8 rounded-full overflow-hidden bg-slate-900 shadow-inner ring-4 ring-slate-50 relative">
            <CameraView onPoseUpdate={handlePoseUpdate} />
            <div className={`absolute inset-0 mix-blend-color transition-colors duration-700 ${
              appState === 'CORRECTIVE' ? 'bg-rose-500/20' : 
              appState === 'DRIFTING' ? 'bg-amber-500/20' : 
              'bg-transparent'
            }`} />
          </div>
        </div>

        {/* Music Controls */}
        <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl flex flex-col gap-4 relative overflow-hidden">
          {/* Subtle audio waveform decoration */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 flex gap-1 items-center">
             <div className="w-1 h-8 bg-white rounded-full animate-pulse"></div>
             <div className="w-1 h-12 bg-white rounded-full animate-pulse delay-75"></div>
             <div className="w-1 h-6 bg-white rounded-full animate-pulse delay-150"></div>
             <div className="w-1 h-10 bg-white rounded-full animate-pulse delay-300"></div>
          </div>

          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Audio Feedback</p>
              <p className="text-white font-medium">Ambient Focus</p>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {appState === 'GOOD' ? 'Clear' : appState === 'DRIFTING' ? 'Softening' : appState === 'CORRECTIVE' ? 'Muffled' : 'Restoring'}
              </p>
            </div>

            <button 
              onClick={toggleAudio}
              className="w-14 h-14 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
              ) : (
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 relative z-10 mt-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9m-9.5-6H5a2 2 0 00-2 2v2a2 2 0 002 2h3.5l4.5 4.5v-15L8.45 10.05z" /></svg>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>

        <button 
          onClick={handleResetCalibration}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600 mx-auto mt-4 underline decoration-slate-300 underline-offset-4"
        >
          Recalibrate Baseline
        </button>
      </main>
    </div>
    );
  };

  return (
    <>
      <audio ref={audioRef} loop>
        <source src="/ambient.wav" type="audio/wav" />
      </audio>
      {renderContent()}
    </>
  );
}

export default App;
