import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseEngine } from '../../vision/PoseEngine';
import { LandmarkProcessor } from '../../vision/LandmarkProcessor';
import { ConfidenceEstimator } from '../../vision/ConfidenceEstimator';
import { PostureLandmarks } from '../../vision/types';
import { FeatureExtractor } from '../../posture/FeatureExtractor';
import { PostureFeatures } from '../../posture/types';
import { App as CapacitorApp } from '@capacitor/app';

export type CameraState = 
  | 'BOOT' 
  | 'PRELOADING_AI' 
  | 'AI_READY' 
  | 'WAITING_FOR_CAMERA' 
  | 'READY' 
  | 'DENIED' 
  | 'UNAVAILABLE' 
  | 'ERROR'
  | 'BACKGROUNDED'
  | 'RESUMING';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  onPoseUpdate?: (landmarks: PostureLandmarks | null, features: PostureFeatures | null, confidence: import('../../vision/ConfidenceEstimator').ConfidenceResult) => void;
}

export function CameraView({ onStreamReady, onPoseUpdate }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>('BOOT');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const engineRef = useRef<PoseEngine | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  
  // Guard flags to prevent race conditions during async initialization
  const isComponentMounted = useRef<boolean>(true);
  const isInitializingCamera = useRef<boolean>(false);
  const isAppActive = useRef<boolean>(true);
  const sessionGeneration = useRef<number>(0);

  const onPoseUpdateRef = useRef(onPoseUpdate);
  const onStreamReadyRef = useRef(onStreamReady);

  useEffect(() => {
    onPoseUpdateRef.current = onPoseUpdate;
    onStreamReadyRef.current = onStreamReady;
  }, [onPoseUpdate, onStreamReady]);

  // Clean teardown of camera and loops
  const stopCameraAndLoops = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const acquireCameraAndStartLoop = useCallback(async (isResume = false) => {
    if (!isAppActive.current || !isComponentMounted.current) return;
    if (isInitializingCamera.current) return;
    
    // Ensure any dangling stream is stopped before requesting a new one
    stopCameraAndLoops();
    
    isInitializingCamera.current = true;
    const currentGen = ++sessionGeneration.current;

    try {
      if (isResume) {
        setCameraState('RESUMING');
      } else {
        setCameraState('WAITING_FOR_CAMERA');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      
      // If generation changed or app backgrounded while waiting, abort cleanly
      if (currentGen !== sessionGeneration.current || !isAppActive.current || !isComponentMounted.current) {
        stream.getTracks().forEach(track => track.stop());
        isInitializingCamera.current = false;
        return;
      }

      activeStreamRef.current = stream;
      setCameraState('READY');
      setErrorMessage('');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (currentGen === sessionGeneration.current && isAppActive.current && isComponentMounted.current) {
            videoRef.current?.play().catch(e => console.warn('Video play prevented', e));
            startInferenceLoop(currentGen);
          }
        };
      }

      if (onStreamReadyRef.current) onStreamReadyRef.current(stream);
    } catch (err: any) {
      console.error('Camera initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('DENIED');
        setErrorMessage('Camera access is required for posture tracking. Please allow permissions.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraState('UNAVAILABLE');
        setErrorMessage('No camera device found.');
      } else {
        setCameraState('ERROR');
        setErrorMessage('An unexpected error occurred while accessing the camera.');
      }
    } finally {
      isInitializingCamera.current = false;
    }
  }, [stopCameraAndLoops]);

  function startInferenceLoop(generationId: number) {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    let lastInferenceTime = 0;
    const INFERENCE_INTERVAL_MS = 100; // max 10 FPS

    function renderLoop(timestamp: number) {
      // Abort if lifecycle state invalidated this loop
      if (generationId !== sessionGeneration.current || !isAppActive.current || !isComponentMounted.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      
      if (!video || !canvas || !engine) {
        animationFrameIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      if (video.readyState < 2) {
        animationFrameIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Throttle inference
      if (timestamp - lastInferenceTime >= INFERENCE_INTERVAL_MS) {
        lastInferenceTime = timestamp;
        
        try {
          const result = engine.detect(video, performance.now());
          
          if (result && isAppActive.current) {
            const landmarks = LandmarkProcessor.process(result);
            const confidence = ConfidenceEstimator.evaluate(landmarks);
            let features = null;

            if (landmarks && confidence.level === 'HIGH') {
              features = FeatureExtractor.extract(landmarks);
            }

            if (onPoseUpdateRef.current) {
              onPoseUpdateRef.current(landmarks, features, confidence);
            }

            // Minimal visualization
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              if (confidence.level === 'LOW') {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                ctx.font = '20px sans-serif';
                ctx.fillText('Low Confidence: Move into view', 20, 40);
              }
            }
          }
        } catch (e) {
          console.error('Inference error:', e);
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    }
    
    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
  }

  // Capacitor App Lifecycle Listener
  useEffect(() => {
    const handleAppStateChange = (state: { isActive: boolean }) => {
      isAppActive.current = state.isActive;
      
      if (!state.isActive) {
        // App went to background -> aggressively pause everything and release camera
        sessionGeneration.current++; // invalidates any pending promises/loops
        stopCameraAndLoops();
        setCameraState('BACKGROUNDED');
      } else {
        // App returned to foreground -> smoothly resume
        if (engineRef.current && engineRef.current.isModelReady) {
          acquireCameraAndStartLoop(true);
        }
      }
    };

    const listener = CapacitorApp.addListener('appStateChange', handleAppStateChange);

    return () => {
      listener.then(l => l.remove());
    };
  }, [acquireCameraAndStartLoop, stopCameraAndLoops]);

  // Initial Boot Sequence
  useEffect(() => {
    isComponentMounted.current = true;

    async function bootSystem() {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        if (!isComponentMounted.current) return;
        setCameraState('PRELOADING_AI');
        const engine = new PoseEngine();
        await engine.initialize();
        engineRef.current = engine;
      } catch (err: any) {
        console.error('Failed to init pose engine:', err);
        setCameraState('ERROR');
        setErrorMessage('Failed to load local AI models.');
        return;
      }

      if (!isComponentMounted.current) return;
      setCameraState('AI_READY');
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('UNAVAILABLE');
        setErrorMessage('Camera access is not supported in this browser.');
        return;
      }

      await acquireCameraAndStartLoop(false);
    }

    bootSystem();

    return () => {
      isComponentMounted.current = false;
      sessionGeneration.current++;
      stopCameraAndLoops();
      if (engineRef.current) {
        engineRef.current.close();
        engineRef.current = null;
      }
    };
  }, [acquireCameraAndStartLoop, stopCameraAndLoops]);

  const getLoadingText = () => {
    switch (cameraState) {
      case 'BOOT': return 'Starting local engine...';
      case 'PRELOADING_AI': return 'Loading local AI...';
      case 'AI_READY': return 'AI engine ready';
      case 'WAITING_FOR_CAMERA': return 'Waiting for camera...';
      case 'RESUMING': return 'Resuming vision...';
      default: return 'Almost ready...';
    }
  };

  const isInitializing = ['BOOT', 'PRELOADING_AI', 'AI_READY', 'WAITING_FOR_CAMERA', 'RESUMING'].includes(cameraState);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-slate-900 rounded-[2rem] overflow-hidden relative">
      
      {isInitializing && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900 text-slate-300">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-slate-700 opacity-50"></div>
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
            <div className="absolute inset-2 rounded-full border-2 border-emerald-400/30 border-b-transparent animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-sm font-medium tracking-wide transition-opacity duration-300">
            {getLoadingText()}
          </p>
        </div>
      )}

      {cameraState === 'BACKGROUNDED' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center text-slate-400 bg-slate-900">
          <p className="text-sm">Paused in background</p>
        </div>
      )}

      {(cameraState === 'DENIED' || cameraState === 'UNAVAILABLE' || cameraState === 'ERROR') && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 text-center text-rose-200 bg-rose-950/90" data-testid="camera-error">
          <div>
            <svg className="w-12 h-12 mx-auto mb-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium leading-relaxed max-w-[250px] mx-auto mb-4">{errorMessage}</p>
            <button 
              onClick={() => acquireCameraAndStartLoop(true)}
              className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-full transition-colors"
            >
              Retry Camera
            </button>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-1000 absolute inset-0 z-0 ${cameraState === 'READY' ? 'opacity-100' : 'opacity-0'}`}
        data-testid="camera-video"
      />
      
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover transform scale-x-[-1] absolute inset-0 z-10 pointer-events-none transition-opacity duration-1000 ${cameraState === 'READY' ? 'opacity-100' : 'opacity-0'}`}
        data-testid="camera-canvas"
      />
    </div>
  );
}
