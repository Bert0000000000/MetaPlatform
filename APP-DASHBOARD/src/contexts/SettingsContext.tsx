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
  /** 解析后的实际主题：'system' 会根据 prefers-color-scheme 解析为 'light' | 'dark'。 */
  resolvedTheme: 'light' | 'dark';
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

/** 解析 'system' 主题为 'light' | 'dark'，依据浏览器 prefers-color-scheme。 */
function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage for instant first paint (avoids theme flash).
  const [settings, setSettings] = useState<UserSettings>(() => loadFromStorage());
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => resolveSystemTheme());
  const [loading, setLoading] = useState(true);

  // Persist to localStorage on every change.
  useEffect(() => {
    saveToStorage(settings);
  }, [settings]);

  // Apply theme to <html data-theme> for global CSS hooks.
  const resolvedTheme: 'light' | 'dark' =
    settings.theme === 'system' ? systemTheme : settings.theme;
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Subscribe to OS theme changes when in 'system' mode.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Sync from backend on mount. 已登录态下后端不可达时由全局 axios 拦截器统一报错，
  // 不再静默兜底，避免个人中心展示与后端不一致。
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
        // 登录页探针（未登录态）：保持 localStorage 默认值，不弹错。
        // 已登录态的错误已由 axios 拦截器统一处理（message.error / 401 跳转）。
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
    const { updateSettings: remoteUpdate } = await import('@/api/settings');
    await remoteUpdate(patch);
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
      value={{ settings, resolvedTheme, loading, updateSettings, setTheme, resetSettings }}
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
