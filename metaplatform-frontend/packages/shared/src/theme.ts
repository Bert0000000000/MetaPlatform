import type { Locale } from 'antd/es/locale';
import type { ThemeConfig } from 'antd';

export interface ThemeMode {
  resolvedTheme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
}

export function useThemeMode(): ThemeMode {
  return {
    resolvedTheme: 'light',
    language: (localStorage.getItem('mate-language') as 'zh-CN' | 'en-US') ?? 'zh-CN',
  };
}

export function getAntdTheme(
  resolvedTheme: 'light' | 'dark',
  _locale: Locale,
): { theme: ThemeConfig } {
  return {
    theme: {
      algorithm: resolvedTheme === 'dark' ? undefined : undefined,
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
      },
    },
  };
}
