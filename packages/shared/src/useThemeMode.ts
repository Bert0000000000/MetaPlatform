import { useEffect, useState, useCallback } from 'react';
import type { ThemeMode, ResolvedTheme } from './types';

/**
 * 跨 APP 共享的主题模式 Hook。
 *
 * - 与 APP-DASHBOARD 的 SettingsContext 共享同一个 localStorage key
 *   `mate_platform_settings`，确保用户在工作台设置的主题在其他 APP 立即可见。
 * - 仅读取主题与语言字段，不依赖后端 API；其他 APP 无需挂载完整 SettingsProvider。
 * - 当用户在 APP-DASHBOARD 中切换主题时，通过 `storage` 事件跨页同步。
 *
 * 使用方式（任意非 DASHBOARD APP 的 App.tsx）：
 *   const { resolvedTheme, language } = useThemeMode();
 *   const { theme, locale } = getAntdTheme(resolvedTheme, language === 'en-US' ? enUS : zhCN);
 *   <ConfigProvider theme={theme} locale={locale}>...</ConfigProvider>
 */
export interface UseThemeModeResult {
  /** 用户选择的主题模式（'light' | 'dark' | 'system'）。 */
  theme: ThemeMode;
  /** 解析后的实际主题：'system' 会根据 prefers-color-scheme 解析为 'light' | 'dark'。 */
  resolvedTheme: ResolvedTheme;
  /** 用户选择的语言（'zh-CN' | 'en-US'）。 */
  language: string;
  /** 切换主题模式（仅更新 localStorage；后端同步由 APP-DASHBOARD 负责）。 */
  setTheme: (mode: ThemeMode) => void;
}

const SETTINGS_KEY = 'mate_platform_settings';

interface StoredSettings {
  theme?: ThemeMode;
  language?: string;
}

function readStoredSettings(): StoredSettings {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      theme: parsed.theme ?? 'light',
      language: parsed.language ?? 'zh-CN',
    };
  } catch {
    return {};
  }
}

function writeStoredTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readStoredSettings();
    const merged = { ...current, theme: mode };
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    // 触发同源其他标签页的 storage 事件以同步主题
    window.dispatchEvent(new StorageEvent('storage', { key: SETTINGS_KEY }));
  } catch {
    // ignore quota errors
  }
}

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemeMode(): UseThemeModeResult {
  const [stored, setStored] = useState<StoredSettings>(() => readStoredSettings());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => resolveSystemTheme());

  const theme: ThemeMode = stored.theme ?? 'light';
  const language: string = stored.language ?? 'zh-CN';
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  // Apply data-theme to <html> for global CSS hooks (与 DASHBOARD 保持一致).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Subscribe to OS theme changes.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Cross-tab sync via storage event.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === null || e.key === SETTINGS_KEY) {
        setStored(readStoredSettings());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    writeStoredTheme(mode);
    setStored((prev) => ({ ...prev, theme: mode }));
  }, []);

  return { theme, resolvedTheme, language, setTheme };
}
