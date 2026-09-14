import { PostureState } from '../posture/PostureStateMachine';
import { PostureConfig } from '../posture/config';
import { SettingsManager } from '../settings/SettingsManager';

export type AudioState = 'UNINITIALIZED' | 'READY' | 'PLAYING' | 'PAUSED' | 'ERROR';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  
  private state: AudioState = 'UNINITIALIZED';
  private primarySrc = '/ambient.wav';
  private fallbackSrc = '/assets/audio/focus1.ogg';
  
  public onStateChange?: (isPlaying: boolean, trackIndex: number) => void;

  private notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange(this.state === 'PLAYING', this.currentTrackIndex);
    }
  }
  
  public initialize(): void {
    if (this.state !== 'UNINITIALIZED') return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API not supported");
      }
      this.ctx = new AudioContextClass();

      // Create audio element programmatically to ensure deterministic lifecycle
      this.audioElement = new Audio();
      this.audioElement.loop = true;
      this.audioElement.crossOrigin = 'anonymous';

      // Attach nodes
      this.sourceNode = this.ctx.createMediaElementSource(this.audioElement);
      this.filter = this.ctx.createBiquadFilter();
      this.gain = this.ctx.createGain();

      this.filter.type = 'lowpass';
      this.filter.frequency.value = 20000;
      this.gain.gain.value = 1.0;

      // Pipeline
      this.sourceNode.connect(this.filter);
      this.filter.connect(this.gain);
      this.gain.connect(this.ctx.destination);

      this.state = 'READY';
    } catch (e) {
      console.error("AudioEngine initialization failed:", e);
      this.state = 'ERROR';
    }
  }

  public async load(): Promise<void> {
    if (this.state === 'ERROR' || !this.audioElement) return;

    try {
      this.audioElement.src = this.primarySrc;
      await new Promise<void>((resolve, reject) => {
        if (!this.audioElement) return reject();
        
        const onCanPlay = () => {
          this.audioElement?.removeEventListener('canplaythrough', onCanPlay);
          this.audioElement?.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          this.audioElement?.removeEventListener('canplaythrough', onCanPlay);
          this.audioElement?.removeEventListener('error', onError);
          reject(new Error("Primary audio failed to load"));
        };
        
        this.audioElement.addEventListener('canplaythrough', onCanPlay);
        this.audioElement.addEventListener('error', onError);
        this.audioElement.load();
      });
    } catch (err) {
      console.warn("Primary audio failed, attempting fallback...", err);
      try {
        this.audioElement.src = this.fallbackSrc;
        this.audioElement.load();
      } catch (fallbackErr) {
        console.error("Fallback audio also failed", fallbackErr);
        this.state = 'ERROR';
      }
    }
  }

  public play(): void {
    if (this.state === 'ERROR' || !this.audioElement || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.error("AudioContext resume failed:", e));
    }
    
    this.audioElement.play().then(() => {
      this.state = 'PLAYING';
      this.notifyStateChange();
    }).catch(e => {
      console.error("HTMLAudioElement play failed:", e);
      this.state = 'ERROR';
      this.notifyStateChange();
    });
  }

  public pause(): void {
    if (this.state === 'ERROR' || !this.audioElement) return;
    this.audioElement.pause();
    this.state = 'PAUSED';
    this.notifyStateChange();
  }

  public setVolume(vol: number): void {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, vol));
    }
  }

  public getVolume(): number {
    return this.audioElement ? this.audioElement.volume : 1.0;
  }

  private tracks: string[] = [
    '/ambient.wav',
    '/assets/audio/focus1.ogg',
    '/assets/audio/focus2.ogg',
    '/assets/audio/focus3.ogg'
  ];
  private currentTrackIndex = 0;

  public playNext(): void {
    if (this.tracks.length === 0) return;
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.loadAndPlayCurrentTrack();
    this.notifyStateChange();
  }

  public playPrevious(): void {
    if (this.tracks.length === 0) return;
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.loadAndPlayCurrentTrack();
    this.notifyStateChange();
  }

  public togglePause(): void {
    if (this.state === 'PLAYING') {
      this.pause();
    } else if (this.state === 'PAUSED' || this.state === 'READY') {
      this.play();
    }
  }
  
  private async loadAndPlayCurrentTrack(): Promise<void> {
    if (!this.audioElement) return;
    
    const wasPlaying = this.state === 'PLAYING';
    if (wasPlaying) {
      this.audioElement.pause();
    }
    
    this.primarySrc = this.tracks[this.currentTrackIndex];
    this.audioElement.src = this.primarySrc;
    this.audioElement.load();
    
    if (wasPlaying) {
      try {
        await this.audioElement.play();
        this.state = 'PLAYING';
        this.notifyStateChange();
      } catch (e) {
        console.error('Failed to play new track:', e);
        this.state = 'ERROR';
        this.notifyStateChange();
      }
    }
  }

  public getTrackIndex(): number {
    return this.currentTrackIndex;
  }

  public getTrackCount(): number {
    return this.tracks.length;
  }

  public resetFeedback(): void {
    this.setMuffling(20000, 1.0);
  }

  public getDiagnostics() {
    return {
      state: this.state,
      actualFreq: this.filter ? this.filter.frequency.value : 0,
      actualGain: this.gain ? this.gain.gain.value : 0,
      trackIndex: this.currentTrackIndex
    };
  }

  private setMuffling(frequency: number, gainTarget: number): void {
    if (!this.ctx || !this.filter || !this.gain || this.state === 'ERROR') return;
    const now = this.ctx.currentTime;
    
    this.filter.frequency.cancelScheduledValues(now);
    this.gain.gain.cancelScheduledValues(now);

    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);

    const transitionTime = PostureConfig.timeouts.audioTransitionMs / 1000.0;
    this.filter.frequency.linearRampToValueAtTime(frequency, now + transitionTime);
    this.gain.gain.linearRampToValueAtTime(gainTarget, now + transitionTime);
  }

  public updateState(state: PostureState): void {
    const settings = SettingsManager.getSettings();

    switch (state) {
      case 'GOOD':
      case 'READY':
      case 'CALIBRATING':
        this.setMuffling(20000, 1.0);
        break;
      case 'LOW_CONFIDENCE':
        if (settings.lowConfidenceAudioBehavior === 'CLEAR') {
          this.setMuffling(20000, 1.0);
        } else if (settings.lowConfidenceAudioBehavior === 'PAUSE') {
          // Effectively mute via Gain to avoid autoplay breaking from HTMLAudioElement.pause()
          this.setMuffling(this.filter ? this.filter.frequency.value : 20000, 0.0);
        }
        // 'MAINTAIN' takes no action, preserving previous filters
        break;
      case 'DRIFTING':
        this.setMuffling(4000, 0.85);
        break;
      case 'CORRECTIVE':
        this.setMuffling(800, 0.6);
        break;
      case 'RECOVERING':
        this.setMuffling(8000, 0.9);
        break;
      default:
        this.resetFeedback();
        break;
    }
  }

  public getState(): AudioState {
    return this.state;
  }

  public getContextState(): AudioContextState | 'unknown' {
    return this.ctx ? this.ctx.state : 'unknown';
  }

  public dispose(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.state = 'UNINITIALIZED';
  }
}
