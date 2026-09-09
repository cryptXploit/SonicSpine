import { useEffect, useState } from 'react';
import { db } from '../../storage/Database';
import { SessionAnalytics } from '../../analytics/SessionManager';

export function Dashboard() {
  const [sessions, setSessions] = useState<SessionAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await db.getRecentSessions(10);
        setSessions(data); // Already descending
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="w-full text-center py-8">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-slate-400 font-medium tracking-wide uppercase">No recent sessions yet</p>
      </div>
    );
  }

  // Calculate average consistency
  const avgConsistency = Math.round(
    sessions.reduce((acc, s) => acc + s.healthScore, 0) / sessions.length
  );
  
  // Format total duration
  const totalMs = sessions.reduce((acc, s) => acc + s.totalSessionDurationMs, 0);
  const totalMin = Math.floor(totalMs / 60000);

  return (
    <div className="w-full mt-4">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Recent Consistency</h3>
      
      <div className="bg-white rounded-[2rem] shadow-lg shadow-slate-200/40 border border-slate-100 p-6 mb-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <p className="text-3xl font-black text-slate-800">{avgConsistency}%</p>
            <p className="text-xs font-semibold text-slate-400 uppercase mt-1 tracking-wider">Avg Consistency</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-slate-700">{totalMin}m</p>
            <p className="text-xs font-semibold text-slate-400 uppercase mt-1 tracking-wider">Total Time</p>
          </div>
        </div>

        {/* Small bar chart representation */}
        <div className="flex items-end gap-2 h-16 pt-2 border-t border-slate-100">
          {sessions.slice(0, 10).map((session, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full group relative">
              <div 
                className={`w-full rounded-t-sm transition-all duration-300 ${session.healthScore > 80 ? 'bg-emerald-400' : session.healthScore > 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                style={{ height: `${Math.max(10, session.healthScore)}%` }}
              />
              {/* Tooltip on hover/tap (native) */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-10">
                {session.healthScore}% ({Math.floor(session.totalSessionDurationMs / 60000)}m)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
