import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { db } from '../../storage/Database';

// Mock DB
vi.mock('../../storage/Database', () => {
  return {
    db: {
      getRecentSessions: vi.fn()
    }
  };
});

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no sessions exist', async () => {
    (db.getRecentSessions as any).mockResolvedValue([]);
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('No recent sessions yet')).toBeInTheDocument();
    });
  });

  it('renders a list of sessions and calculates average score', async () => {
    const mockSessions = [
      { id: 1, timestamp: Date.now(), healthScore: 100, totalSessionDurationMs: 60000, deviationCount: 0 },
      { id: 2, timestamp: Date.now(), healthScore: 50, totalSessionDurationMs: 60000, deviationCount: 5 }
    ];
    (db.getRecentSessions as any).mockResolvedValue(mockSessions);
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Consistency')).toBeInTheDocument();
    });

    // Avg of 100 and 50 is 75
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('2m')).toBeInTheDocument(); // 60000 + 60000 = 120000ms = 2m
  });
});
