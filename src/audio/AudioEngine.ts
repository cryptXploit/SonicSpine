import { PostureState } from '../posture/PostureStateMachine';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  
  private initialized = false;

  public initialize(audioElement: HTMLMediaElement) {
    if (this.initialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("Web Audio API not supported in this browser.");
        return;
      }

      this.ctx = new AudioContextClass();
      
      this.source = this.ctx.createMediaElementSource(audioElement);
      this.filter = this.ctx.createBiquadFilter();
      this.gain = this.ctx.createGain();

      this.filter.type = 'lowpass';
      this.filter.frequency.value = 20000; 
      
      this.gain.gain.value = 1.0;

      // Pipeline: Source -> Filter -> Gain -> Destination
      this.source.connect(this.filter);
      this.filter.connect(this.gain);
      this.gain.connect(this.ctx.destination);

      this.initialized = true;
    } catch (e) {
      console.error("AudioEngine initialization failed:", e);
      // Graceful failure as per constitution
    }
  }

  public async resumeContext(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.error("Failed to resume AudioContext", e);
      }
    }
  }

  public updateState(state: PostureState) {
    if (!this.ctx || !this.filter || !this.gain) return;

    const now = this.ctx.currentTime;
    
    // Cancel previously scheduled ramps so we don't overlap conflicting changes
    this.filter.frequency.cancelScheduledValues(now);
    this.gain.gain.cancelScheduledValues(now);

    // Keep the current value steady before ramping to prevent jumps
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);

    const transitionTime = 1.5; // Smooth 1.5 seconds transition

    switch (state) {
      case 'GOOD':
      case 'READY':
      case 'CALIBRATING':
        // Clear audio
        this.filter.frequency.linearRampToValueAtTime(20000, now + transitionTime);
        this.gain.gain.linearRampToValueAtTime(1.0, now + transitionTime);
        break;
      
      case 'DRIFTING':
        // Mild filtering - muffler effect
        this.filter.frequency.linearRampToValueAtTime(4000, now + transitionTime);
        this.gain.gain.linearRampToValueAtTime(0.85, now + transitionTime);
        break;

      case 'CORRECTIVE':
      case 'LOW_CONFIDENCE':
        // Strong filtering - underwater effect
        this.filter.frequency.linearRampToValueAtTime(800, now + transitionTime);
        this.gain.gain.linearRampToValueAtTime(0.6, now + transitionTime);
        break;

      case 'RECOVERING':
        // Gradually restoring
        this.filter.frequency.linearRampToValueAtTime(8000, now + transitionTime);
        this.gain.gain.linearRampToValueAtTime(0.9, now + transitionTime);
        break;
        
      default:
        this.filter.frequency.linearRampToValueAtTime(20000, now + transitionTime);
        this.gain.gain.linearRampToValueAtTime(1.0, now + transitionTime);
        break;
    }
  }
}
