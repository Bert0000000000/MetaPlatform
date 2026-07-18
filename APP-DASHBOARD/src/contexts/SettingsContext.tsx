import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { UserSettings, ThemeMode } from '@/types';

const SETTINGS_KEY = 'mate_platform_settings';

const DEFAULT_SETTINGS: UserSettings = {
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
  defaultPage: '/dashboard',
  theme: 'light',
  layout: ['metrics', 'approvals', 'workers', 'notifications'],
};

interface SettingsContextValue {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadFromStorage(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveToStorage(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage for instant first paint (avoids theme flash).
  const [settings, setSettings] = useState<UserSettings>(() => loadFromStorage());
  const [loading, setLoading] = useState(true);

  // Persist to localStorage on every change.
  useEffect(() => {
    saveToStorage(settings);
  }, [settings]);

  // Apply theme to <html data-theme> for global CSS hooks.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Sync from backend on mount (best-effort; falls back to local on failure).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getSettings } = await import('@/api/settings');
        const remote = await getSettings();
        if (!cancelled && remote) {
          setSettings((prev) => ({ ...prev, ...remote }));
        }
      } catch {
        // Backend not ready; keep using localStorage value.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      const { updateSettings: remoteUpdate } = await import('@/api/settings');
      await remoteUpdate(patch);
    } catch {
      // Backend not ready; local persistence is enough.
    }
  }, []);

  const setTheme = useCallback(
    async (theme: ThemeMode) => {
      await updateSettings({ theme });
    },
    [updateSettings],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, loading, updateSettings, setTheme, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
