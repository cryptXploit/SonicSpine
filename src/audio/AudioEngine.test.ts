import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from './AudioEngine';

// Mock Web Audio API classes
class MockAudioParam {
  value: number = 0;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}

class MockBiquadFilterNode {
  type = 'lowpass';
  frequency = new MockAudioParam();
  connect = vi.fn();
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = vi.fn();
}

describe('AudioEngine', () => {
  let mockAudioContext: any;
  let mockFilter: MockBiquadFilterNode;
  let mockGain: MockGainNode;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFilter = new MockBiquadFilterNode();
    mockGain = new MockGainNode();

    mockAudioContext = vi.fn(function() {
      return {
        state: 'suspended',
        currentTime: 10,
        destination: {},
        resume: vi.fn().mockResolvedValue(undefined),
        createMediaElementSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
        createBiquadFilter: vi.fn().mockReturnValue(mockFilter),
        createGain: vi.fn().mockReturnValue(mockGain),
      };
    });

    Object.defineProperty(window, 'AudioContext', {
      value: mockAudioContext,
      writable: true
    });
  });

  it('initializes gracefully', () => {
    const engine = new AudioEngine();
    
    
    // Should not throw
    engine.initialize();
    
    expect(mockAudioContext).toHaveBeenCalled();
    expect(mockFilter.frequency.value).toBe(20000); // starts clear
    expect(mockGain.gain.value).toBe(1.0);
  });

  it('fails gracefully if AudioContext is not supported', () => {
    Object.defineProperty(window, 'AudioContext', { value: undefined, writable: true });
    
    const engine = new AudioEngine();
    
    
    // Should safely abort without throwing
    expect(() => engine.initialize()).not.toThrow();
  });

  it('applies mild filter for DRIFTING state', () => {
    const engine = new AudioEngine();
    
    engine.initialize();
    
    engine.updateState('DRIFTING');
    
    expect(mockFilter.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(4000, 11.5); // 10s + 1.5s
    expect(mockGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.85, 11.5);
  });

  it('applies strong filter for CORRECTIVE state', () => {
    const engine = new AudioEngine();
    
    engine.initialize();
    
    engine.updateState('CORRECTIVE');
    
    expect(mockFilter.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(800, 11.5);
  });

  it('restores clear audio for GOOD state', () => {
    const engine = new AudioEngine();
    
    engine.initialize();
    
    engine.updateState('GOOD');
    
    expect(mockFilter.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(20000, 11.5);
  });
});
