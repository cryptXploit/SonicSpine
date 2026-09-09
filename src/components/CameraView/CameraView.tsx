import { useEffect, useRef, useState } from 'react';

export type CameraState = 'INITIALIZING' | 'READY' | 'DENIED' | 'UNAVAILABLE' | 'ERROR';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
}

export function CameraView({ onStreamReady }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initializeCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('UNAVAILABLE');
        setErrorMessage('Camera access is not supported in this browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });
        
        activeStream = stream;
        setCameraState('READY');
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        if (onStreamReady) {
          onStreamReady(stream);
        }
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

    initializeCamera();

    return () => {
      // Cleanup video stream when component unmounts
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onStreamReady]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-slate-900 rounded-lg overflow-hidden relative">
      {cameraState === 'INITIALIZING' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-slate-800">
          <p>Initializing camera...</p>
        </div>
      )}

      {(cameraState === 'DENIED' || cameraState === 'UNAVAILABLE' || cameraState === 'ERROR') && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-200 bg-red-900/90" data-testid="camera-error">
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
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${cameraState === 'READY' ? 'opacity-100' : 'opacity-0'}`}
        data-testid="camera-video"
      />
    </div>
  );
}
