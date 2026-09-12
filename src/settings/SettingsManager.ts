export interface AppSettings {
  screenPresenceGracePeriodMs: number;
  recoveryDelayMs: number;
  lowConfidenceAudioBehavior: 'CLEAR' | 'MAINTAIN' | 'PAUSE';
  enableGestures: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  screenPresenceGracePeriodMs: 5000,
  recoveryDelayMs: 0,
  lowConfidenceAudioBehavior: 'CLEAR',
  enableGestures: false
};

const SETTINGS_KEY = 'sonicspine_settings';

export class SettingsManager {
  private static cachedSettings: AppSettings | null = null;

  public static getSettings(): AppSettings {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (!stored) {
        this.cachedSettings = { ...DEFAULT_SETTINGS };
        return this.cachedSettings;
      }

      const parsed = JSON.parse(stored);
      
      // Validate and fallback
      this.cachedSettings = {
        screenPresenceGracePeriodMs: typeof parsed.screenPresenceGracePeriodMs === 'number' && parsed.screenPresenceGracePeriodMs >= 0 
          ? parsed.screenPresenceGracePeriodMs 
          : DEFAULT_SETTINGS.screenPresenceGracePeriodMs,
        
        recoveryDelayMs: typeof parsed.recoveryDelayMs === 'number' && parsed.recoveryDelayMs >= 0 
          ? parsed.recoveryDelayMs 
          : DEFAULT_SETTINGS.recoveryDelayMs,
        
        lowConfidenceAudioBehavior: ['CLEAR', 'MAINTAIN', 'PAUSE'].includes(parsed.lowConfidenceAudioBehavior) 
          ? parsed.lowConfidenceAudioBehavior 
          : DEFAULT_SETTINGS.lowConfidenceAudioBehavior,
          
        enableGestures: typeof parsed.enableGestures === 'boolean' 
          ? parsed.enableGestures 
          : DEFAULT_SETTINGS.enableGestures
      };

      return this.cachedSettings;
    } catch (e) {
      console.warn("Failed to parse settings, falling back to defaults", e);
      this.cachedSettings = { ...DEFAULT_SETTINGS };
      return this.cachedSettings;
    }
  }

  public static saveSettings(newSettings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      this.cachedSettings = { ...newSettings };
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  }

  public static resetToDefaults(): AppSettings {
    this.saveSettings(DEFAULT_SETTINGS);
    return this.getSettings();
  }
}
