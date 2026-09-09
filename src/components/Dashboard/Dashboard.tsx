import { useEffect, useState } from 'react';
import { db, SavedSession } from '../../storage/Database';

export function Dashboard() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchSessions() {
      try {
        const recent = await db.getRecentSessions(10);
        if (mounted) setSessions(recent);
      } catch (e) {
        console.error("Failed to fetch sessions", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchSessions();
    
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading history...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="p-8 mt-6 text-center bg-slate-50 rounded-2xl border border-slate-200" data-testid="dashboard-empty">
        <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-slate-500 font-medium">No sessions recorded yet.</p>
        <p className="text-sm text-slate-400 mt-1">Start tracking your posture to build your history!</p>
      </div>
    );
  }

  const avgScore = Math.round(
    sessions.reduce((acc, s) => acc + s.healthScore, 0) / sessions.length
  );

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="w-full max-w-4xl mt-8" data-testid="dashboard-history">
      <h2 className="text-xl font-bold text-slate-800 mb-4 px-2">Your Progress</h2>
      
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 mb-6 border border-emerald-100/50 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-sm text-emerald-700/80 font-medium mb-1">Recent Average</p>
          <p className="text-4xl font-bold text-emerald-600">{avgScore}%</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-emerald-700/80 font-medium mb-1">Sessions</p>
          <p className="text-2xl font-bold text-emerald-600">{sessions.length}</p>
        </div>
      </div>

      <div className="space-y-3">
        {sessions.map((session, i) => (
          <div key={session.id || i} className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
            <div>
              <p className="font-semibold text-slate-700 mb-1">
                {new Date(session.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {new Date(session.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
              <div className="flex gap-3 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatTime(session.totalSessionDurationMs)}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {session.deviationCount} corrections
                </span>
              </div>
            </div>
            <div className={`text-2xl font-bold ${session.healthScore >= 80 ? 'text-emerald-500' : session.healthScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {session.healthScore}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
