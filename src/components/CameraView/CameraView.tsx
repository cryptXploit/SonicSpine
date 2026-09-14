import { useEffect, useRef, useState } from 'react';
import { PoseEngine } from '../../vision/PoseEngine';
import { LandmarkProcessor } from '../../vision/LandmarkProcessor';
import { ConfidenceEstimator } from '../../vision/ConfidenceEstimator';
import { PostureLandmarks } from '../../vision/types';
import { FeatureExtractor } from '../../posture/FeatureExtractor';
import { PostureFeatures } from '../../posture/types';

export type CameraState = 
  | 'BOOT' 
  | 'PRELOADING_AI' 
  | 'AI_READY' 
  | 'WAITING_FOR_CAMERA' 
  | 'READY' 
  | 'DENIED' 
  | 'UNAVAILABLE' 
  | 'ERROR';

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

  const onPoseUpdateRef = useRef(onPoseUpdate);
  const onStreamReadyRef = useRef(onStreamReady);

  useEffect(() => {
    onPoseUpdateRef.current = onPoseUpdate;
    onStreamReadyRef.current = onStreamReady;
  }, [onPoseUpdate, onStreamReady]);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let animationFrameId: number;
    let lastInferenceTime = 0;
    const INFERENCE_INTERVAL_MS = 100; // max 10 FPS for performance

    async function initializeSystem() {
      // Small artificial delay to allow React to paint the BOOT state
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
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

      setCameraState('AI_READY');
      await new Promise(resolve => setTimeout(resolve, 50)); // let UI update

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('UNAVAILABLE');
        setErrorMessage('Camera access is not supported in this browser.');
        return;
      }

      try {
        setCameraState('WAITING_FOR_CAMERA');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        
        activeStream = stream;
        setCameraState('READY');
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            startInferenceLoop();
          };
        }

        if (onStreamReadyRef.current) onStreamReadyRef.current(stream);
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraState('DENIED');
          setErrorMessage('Camera access is required for posture tracking. Please allow camera permissions.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraState('UNAVAILABLE');
          setErrorMessage('No camera device found.');
        } else {
          setCameraState('ERROR');
          setErrorMessage('An unexpected error occurred while accessing the camera.');
        }
      }
    }

    function startInferenceLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      
      if (!video || !canvas || !engine) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      function renderLoop(timestamp: number) {
        if (!video || video.readyState < 2) {
          animationFrameId = requestAnimationFrame(renderLoop);
          return;
        }

        if (canvas!.width !== video.videoWidth) {
          canvas!.width = video.videoWidth;
          canvas!.height = video.videoHeight;
        }

        // Throttle inference
        if (timestamp - lastInferenceTime >= INFERENCE_INTERVAL_MS) {
          lastInferenceTime = timestamp;
          
          const result = engine!.detect(video, performance.now());
          
          const landmarks = LandmarkProcessor.process(result);
          const confidence = ConfidenceEstimator.evaluate(landmarks);
          let features = null;

          if (landmarks && confidence.level === 'HIGH') {
            features = FeatureExtractor.extract(landmarks);
          }

          if (onPoseUpdateRef.current) {
            onPoseUpdateRef.current(landmarks, features, confidence);
          }

          // Minimal visualization: clear canvas. We will remove the skeleton later as per directive.
          // For now, just show low confidence warnings if needed.
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
          
          if (confidence.level === 'LOW') {
            ctx!.fillStyle = 'rgba(255, 0, 0, 0.7)';
            ctx!.font = '20px sans-serif';
            ctx!.fillText('Low Confidence: Move into view', 20, 40);
          }
        }

        animationFrameId = requestAnimationFrame(renderLoop);
      }
      
      animationFrameId = requestAnimationFrame(renderLoop);
    }

    initializeSystem();

    return () => {
      if (activeStream) activeStream.getTracks().forEach((track) => track.stop());
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (engineRef.current) engineRef.current.close();
    };
  }, []);

  const getLoadingText = () => {
    switch (cameraState) {
      case 'BOOT': return 'Starting local engine...';
      case 'PRELOADING_AI': return 'Loading local AI...';
      case 'AI_READY': return 'AI engine ready';
      case 'WAITING_FOR_CAMERA': return 'Waiting for camera...';
      default: return 'Almost ready...';
    }
  };

  const isInitializing = ['BOOT', 'PRELOADING_AI', 'AI_READY', 'WAITING_FOR_CAMERA'].includes(cameraState);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-slate-900 rounded-[2rem] overflow-hidden relative">
      
      {isInitializing && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900 text-slate-300">
          <div className="relative w-24 h-24 mb-6">
            {/* Elegant rotating ring */}
            <div className="absolute inset-0 rounded-full border-4 border-slate-700 opacity-50"></div>
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
            <div className="absolute inset-2 rounded-full border-2 border-emerald-400/30 border-b-transparent animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
            {/* Inner pulsing dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-sm font-medium tracking-wide transition-opacity duration-300">
            {getLoadingText()}
          </p>
        </div>
      )}

      {(cameraState === 'DENIED' || cameraState === 'UNAVAILABLE' || cameraState === 'ERROR') && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 text-center text-rose-200 bg-rose-950/90" data-testid="camera-error">
          <div>
            <svg className="w-12 h-12 mx-auto mb-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium leading-relaxed max-w-[250px] mx-auto">{errorMessage}</p>
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
