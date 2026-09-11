import { PostureState } from '../../posture/PostureStateMachine';
import { PostureFeatures } from '../../posture/types';
import { PostureDeviations } from '../../posture/TemporalFilter';
import { ConfidenceResult } from '../../vision/ConfidenceEstimator';

interface DiagnosticPanelProps {
  state: PostureState;
  confidence: ConfidenceResult | null;
  features: PostureFeatures | null;
  deviations: PostureDeviations | null;
  motionStability: number;
  stateFlags: {
    isDrifting: boolean;
    isCorrective: boolean;
    isRecovered: boolean;
  };
  evidence: number;
  audio: { actualFreq: number; actualGain: number } | null;
}

export function DiagnosticPanel({
  state,
  confidence,
  features,
  deviations,
  motionStability,
  stateFlags,
  evidence,
  audio
}: DiagnosticPanelProps) {
  return (
    <div className="absolute top-4 left-4 bg-black/80 text-green-400 p-4 rounded text-xs font-mono w-64 z-50 overflow-hidden" data-testid="diagnostic-panel">
      <h3 className="font-bold border-b border-green-700 pb-1 mb-2">SonicSpine Diagnostics</h3>
      
      <div className="mb-2">
        <div className="flex justify-between"><span>State:</span> <span className="font-bold text-white">{state}</span></div>
        <div className="flex justify-between">
          <span>Confidence:</span> 
          <span className={confidence?.level === 'HIGH' ? 'text-green-400' : 'text-red-400'}>
            {confidence?.level} ({(confidence?.score || 0).toFixed(2)})
          </span>
        </div>
        <div className="flex justify-between"><span>Motion Stb:</span> <span>{motionStability.toFixed(2)}</span></div>
      </div>

      <div className="mb-2">
        <h4 className="text-green-600 font-bold">Flags</h4>
        <div className="flex gap-2 justify-between">
          <span className={stateFlags.isDrifting ? 'text-yellow-400' : 'text-gray-600'}>Drift</span>
          <span className={stateFlags.isCorrective ? 'text-red-400' : 'text-gray-600'}>Corr</span>
          <span className={stateFlags.isRecovered ? 'text-green-400' : 'text-gray-600'}>Recov</span>
        </div>
        <div className="flex justify-between mt-1 pt-1 border-t border-green-800">
          <span className="font-bold">Evidence:</span> 
          <span className={`font-bold ${evidence > 50 ? 'text-red-400' : ''}`}>
            {evidence.toFixed(1)} / 100
          </span>
        </div>
      </div>

      {deviations && (
        <div className="mb-2">
          <h4 className="text-green-600 font-bold">Contributions</h4>
          <div className="flex justify-between"><span>Tilt:</span> <span>{deviations.headTiltDeviation.toFixed(1)}</span></div>
          <div className="flex justify-between"><span>Roll:</span> <span>{deviations.shoulderRollDeviation.toFixed(1)}</span></div>
          <div className="flex justify-between"><span>Crane:</span> <span>{deviations.craneDeviation.toFixed(1)}</span></div>
          <div className="flex justify-between"><span>Collapse:</span> <span>{deviations.collapseDeviation.toFixed(1)}</span></div>
          <div className="flex justify-between mt-1 pt-1 border-t border-green-800">
            <span className="font-bold">Total Penalty:</span> 
            <span className={`font-bold ${deviations.totalPenalty > 60 ? 'text-yellow-400' : ''}`}>
              {deviations.totalPenalty.toFixed(1)}
            </span>
          </div>
        </div>
      )}

      {audio && (
        <div className="mb-2 opacity-90">
          <h4 className="text-green-600 font-bold">Audio Diagnostics</h4>
          <div className="flex justify-between"><span>Freq (Hz):</span> <span>{audio.actualFreq.toFixed(0)}</span></div>
          <div className="flex justify-between"><span>Gain:</span> <span>{audio.actualGain.toFixed(2)}</span></div>
        </div>
      )}

      {features && (
        <div className="opacity-70">
          <h4 className="text-green-600 font-bold">Raw Features</h4>
          <div className="flex justify-between"><span>Yaw:</span> <span>{(features.noseYawDeviation || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Crane R:</span> <span>{features.forwardCraneRatio.toFixed(3)}</span></div>
          <div className="flex justify-between"><span>Collapse R:</span> <span>{features.neckCollapseRatio.toFixed(3)}</span></div>
        </div>
      )}
    </div>
  );
}
