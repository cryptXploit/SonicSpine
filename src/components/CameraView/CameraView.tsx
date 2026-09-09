import { useEffect, useRef, useState } from 'react';
import { PoseEngine } from '../../vision/PoseEngine';
import { LandmarkProcessor } from '../../vision/LandmarkProcessor';
import { ConfidenceEstimator } from '../../vision/ConfidenceEstimator';
import { PostureLandmarks } from '../../vision/types';
import { FeatureExtractor } from '../../posture/FeatureExtractor';
import { PostureFeatures } from '../../posture/types';

export type CameraState = 'INITIALIZING' | 'READY' | 'DENIED' | 'UNAVAILABLE' | 'ERROR';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  onPoseUpdate?: (landmarks: PostureLandmarks | null, features: PostureFeatures | null, confidence: 'HIGH' | 'LOW' | 'NONE') => void;
}

export function CameraView({ onStreamReady, onPoseUpdate }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const engineRef = useRef<PoseEngine | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let animationFrameId: number;

    async function initializeSystem() {
      // 1. Initialize Pose Engine
      try {
        const engine = new PoseEngine();
        await engine.initialize();
        engineRef.current = engine;
      } catch (err: any) {
        console.error('Failed to init pose engine:', err);
        setCameraState('ERROR');
        setErrorMessage('Failed to initialize posture engine.');
        return;
      }

      // 2. Initialize Camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('UNAVAILABLE');
        setErrorMessage('Camera access is not supported in this browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });
        
        activeStream = stream;
        setCameraState('READY');
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Start inference loop once video plays
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            startInferenceLoop();
          };
        }

        if (onStreamReady) onStreamReady(stream);
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

      function renderLoop() {
        if (!video || video.readyState < 2) {
          animationFrameId = requestAnimationFrame(renderLoop);
          return;
        }

        // Match canvas to video dimensions
        if (canvas!.width !== video.videoWidth) {
          canvas!.width = video.videoWidth;
          canvas!.height = video.videoHeight;
        }

        // Run inference
        const timestamp = performance.now();
        const result = engine!.detect(video, timestamp);
        
        const landmarks = LandmarkProcessor.process(result);
        const confidence = ConfidenceEstimator.evaluate(landmarks);
        let features = null;

        if (landmarks && confidence === 'HIGH') {
          features = FeatureExtractor.extract(landmarks);
        }

        if (onPoseUpdate) {
          onPoseUpdate(landmarks, features, confidence);
        }

        // Visualization
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        
        if (landmarks && confidence === 'HIGH') {
          drawSkeleton(ctx!, landmarks, canvas!.width, canvas!.height);
        } else if (confidence === 'LOW') {
          ctx!.fillStyle = 'rgba(255, 0, 0, 0.5)';
          ctx!.font = '24px sans-serif';
          ctx!.fillText('Low Confidence: Please move into view', 20, 40);
        }

        animationFrameId = requestAnimationFrame(renderLoop);
      }
      
      renderLoop();
    }

    initializeSystem();

    return () => {
      if (activeStream) activeStream.getTracks().forEach((track) => track.stop());
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [onStreamReady, onPoseUpdate]);

  function drawSkeleton(ctx: CanvasRenderingContext2D, landmarks: PostureLandmarks, w: number, h: number) {
    ctx.save();
    ctx.fillStyle = '#10b981'; // emerald-500
    ctx.strokeStyle = '#34d399'; // emerald-400
    ctx.lineWidth = 4;

    const drawPoint = (pt: {x: number, y: number}) => {
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 6, 0, 2 * Math.PI);
      ctx.fill();
    };

    const drawLine = (pt1: {x: number, y: number}, pt2: {x: number, y: number}) => {
      ctx.beginPath();
      ctx.moveTo(pt1.x * w, pt1.y * h);
      ctx.lineTo(pt2.x * w, pt2.y * h);
      ctx.stroke();
    };

    // Draw lines
    drawLine(landmarks.leftShoulder, landmarks.rightShoulder);
    drawLine(landmarks.leftEar, landmarks.leftShoulder);
    drawLine(landmarks.rightEar, landmarks.rightShoulder);
    
    // Draw points
    drawPoint(landmarks.nose);
    drawPoint(landmarks.leftEar);
    drawPoint(landmarks.rightEar);
    drawPoint(landmarks.leftShoulder);
    drawPoint(landmarks.rightShoulder);

    ctx.restore();
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-slate-900 rounded-lg overflow-hidden relative">
      {cameraState === 'INITIALIZING' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center text-white bg-slate-800">
          <p>Initializing camera and AI engine...</p>
        </div>
      )}

      {(cameraState === 'DENIED' || cameraState === 'UNAVAILABLE' || cameraState === 'ERROR') && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6 text-center text-red-200 bg-red-900/90" data-testid="camera-error">
          <div>
            <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-lg font-medium">{errorMessage}</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 absolute inset-0 z-0 ${cameraState === 'READY' ? 'opacity-100' : 'opacity-0'}`}
        data-testid="camera-video"
      />
      
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover transform scale-x-[-1] absolute inset-0 z-10 pointer-events-none ${cameraState === 'READY' ? 'opacity-100' : 'opacity-0'}`}
        data-testid="camera-canvas"
      />
    </div>
  );
}
