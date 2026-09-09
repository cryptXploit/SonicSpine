import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { Database } from './Database';
import { SessionAnalytics } from '../analytics/SessionManager';

describe('Database (IndexedDB)', () => {
  let db: Database;

  beforeEach(async () => {
    db = new Database();
  });

  afterEach(() => {
    db.close();
  });

  const createDummySession = (score: number): SessionAnalytics => ({
    totalSessionDurationMs: 60000,
    timeInGoodMs: 50000,
    timeInDriftingMs: 5000,
    timeInCorrectiveMs: 5000,
    deviationCount: 2,
    healthScore: score
  });

  it('initializes the database correctly', async () => {
    await expect(db.init()).resolves.toBeUndefined();
  });

  it('saves a session and auto-increments the ID', async () => {
    const id1 = await db.saveSession(createDummySession(80));
    const id2 = await db.saveSession(createDummySession(90));

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id2).toBeGreaterThan(id1);
  });

  it('retrieves recent sessions in descending chronological order', async () => {
    // Add multiple sessions sequentially
    await db.saveSession(createDummySession(70));
    // Simulate time passing
    await new Promise(r => setTimeout(r, 10));
    await db.saveSession(createDummySession(85));
    await new Promise(r => setTimeout(r, 10));
    await db.saveSession(createDummySession(100));

    const sessions = await db.getRecentSessions(2); // Get top 2 most recent

    expect(sessions).toHaveLength(2);
    expect(sessions[0].healthScore).toBe(100); // Most recent
    expect(sessions[1].healthScore).toBe(85);  // Second most recent
  });
});
