import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraView } from './CameraView';

vi.mock('../../vision/PoseEngine', () => {
  return {
    PoseEngine: class {
      initialize = vi.fn().mockResolvedValue(true);
      detect = vi.fn().mockReturnValue(null);
      close = vi.fn();
      get isModelReady() { return true; }
    }
  };
});

describe('CameraView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows unavailable error if mediaDevices is not supported', async () => {
    // Mock navigator.mediaDevices as undefined
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });

    render(<CameraView />);

    await waitFor(() => {
      expect(screen.getByTestId('camera-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Camera access is not supported in this browser.')).toBeInTheDocument();
  });

  it('shows denied error when permission is refused', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue({ name: 'NotAllowedError' }),
      },
      configurable: true,
    });

    render(<CameraView />);

    await waitFor(() => {
      expect(screen.getByTestId('camera-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/Camera access is required/i)).toBeInTheDocument();
  });

  it('shows not found error when no camera is present', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue({ name: 'NotFoundError' }),
      },
      configurable: true,
    });

    render(<CameraView />);

    await waitFor(() => {
      expect(screen.getByTestId('camera-error')).toBeInTheDocument();
    });
    expect(screen.getByText('No camera device found.')).toBeInTheDocument();
  });

  it('initializes camera successfully', async () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    };

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
    });

    render(<CameraView />);

    await waitFor(() => {
      expect(screen.queryByTestId('camera-error')).not.toBeInTheDocument();
      const video = screen.getByTestId('camera-video') as HTMLVideoElement;
      expect(video).toBeInTheDocument();
    });
  });
});
