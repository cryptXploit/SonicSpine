import { useEffect, useState } from 'react';
import { db } from '../../storage/Database';
import { SessionAnalytics } from '../../analytics/SessionManager';
import { entitlementService } from '../../monetization/RevenueCatAdapter';
import { EntitlementStatus } from '../../monetization/EntitlementService';

export function Dashboard() {
  const [sessions, setSessions] = useState<SessionAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitlement, setEntitlement] = useState<EntitlementStatus>('UNKNOWN');
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await db.getRecentSessions(10);
        setSessions(data); // Already descending
        const status = await entitlementService.checkEntitlement();
        setEntitlement(status);
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleUpgrade = async () => {
    setIsPurchasing(true);
    const success = await entitlementService.purchasePro();
    if (success) {
      setEntitlement('PRO');
    }
    setIsPurchasing(false);
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    const success = await entitlementService.restorePurchases();
    if (success) {
      setEntitlement('PRO');
    } else {
      alert("No active purchases found to restore.");
    }
    setIsPurchasing(false);
  };

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

      {/* RevenueCat PRO Banner */}
      {entitlement !== 'PRO' && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] shadow-lg shadow-slate-900/20 p-6 text-center mt-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-1 relative z-10">Unlock SonicSpine Pro</h3>
          <p className="text-slate-400 text-xs mb-4 relative z-10">Get detailed analytics and heatmaps.</p>
          <button 
            onClick={handleUpgrade}
            disabled={isPurchasing}
            className="w-full py-3 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-xl shadow-lg transition active:scale-[0.98] relative z-10 disabled:opacity-50"
          >
            {isPurchasing ? 'Processing...' : 'Upgrade Now'}
          </button>
          <button 
            onClick={handleRestore}
            disabled={isPurchasing}
            className="mt-3 text-slate-400 hover:text-white text-[10px] uppercase tracking-wider font-bold underline decoration-slate-600 underline-offset-4 relative z-10"
          >
            Restore Purchases
          </button>
        </div>
      )}
    </div>
  );
}
