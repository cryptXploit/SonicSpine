import { useState, useEffect } from 'react';
import { SettingsManager, AppSettings } from '../../settings/SettingsManager';

export function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>(SettingsManager.getSettings());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Re-fetch on mount just in case
    setSettings(SettingsManager.getSettings());
  }, []);

  const handleChange = (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    SettingsManager.saveSettings(newSettings);
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to restore default settings?')) {
      const defaults = SettingsManager.resetToDefaults();
      setSettings(defaults);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="w-full mt-6">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Settings</h3>
      
      <div className="bg-white rounded-[2rem] shadow-lg shadow-slate-200/40 border border-slate-100 p-6">
        
        {/* Screen Presence Grace Period */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Screen Presence Grace Period</label>
          <p className="text-xs text-slate-400 mb-3">How long you can remain out of frame before audio responds.</p>
          <select 
            value={settings.screenPresenceGracePeriodMs}
            onChange={(e) => handleChange('screenPresenceGracePeriodMs', parseInt(e.target.value))}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value={2000}>2 Seconds</option>
            <option value={5000}>5 Seconds (Default)</option>
            <option value={10000}>10 Seconds</option>
            <option value={20000}>20 Seconds</option>
          </select>
        </div>

        {/* Recovery Delay */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Recovery Delay</label>
          <p className="text-xs text-slate-400 mb-3">How long you must maintain good posture before audio clears completely.</p>
          <select 
            value={settings.recoveryDelayMs}
            onChange={(e) => handleChange('recoveryDelayMs', parseInt(e.target.value))}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value={0}>Instant (Default)</option>
            <option value={1000}>1 Second</option>
            <option value={2000}>2 Seconds</option>
            <option value={5000}>5 Seconds</option>
          </select>
        </div>

        {/* Low Confidence Audio Behavior */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Low Confidence Audio Policy</label>
          <p className="text-xs text-slate-400 mb-3">What happens to the audio when you leave the frame.</p>
          <select 
            value={settings.lowConfidenceAudioBehavior}
            onChange={(e) => handleChange('lowConfidenceAudioBehavior', e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="CLEAR">Clear Audio (Default)</option>
            <option value="MAINTAIN">Maintain Last State</option>
            <option value="PAUSE">Mute Audio</option>
          </select>
        </div>

        {/* Enable Hand Gestures */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            Hand Gesture Control <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">Beta</span>
          </label>
          <p className="text-xs text-slate-400 mb-3">Swipe up/down to control volume without touching your device.</p>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={settings.enableGestures}
              onChange={(e) => handleChange('enableGestures', e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-3 text-sm font-medium text-slate-700">{settings.enableGestures ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
          <button 
            onClick={handleReset}
            className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors underline decoration-slate-300 underline-offset-4 hover:decoration-rose-500"
          >
            Restore Defaults
          </button>
          
          <span className={`text-xs font-bold text-emerald-500 transition-opacity duration-300 ${isSaved ? 'opacity-100' : 'opacity-0'}`}>
            Saved
          </span>
        </div>

      </div>
    </div>
  );
}
