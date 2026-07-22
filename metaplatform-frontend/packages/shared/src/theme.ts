import type { Locale } from 'antd/es/locale';
import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

export interface ThemeMode {
  resolvedTheme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
}

export function useThemeMode(): ThemeMode {
  return {
    resolvedTheme: 'dark',
    language: (localStorage.getItem('mate-language') as 'zh-CN' | 'en-US') ?? 'zh-CN',
  };
}

export function getAntdTheme(
  resolvedTheme: 'light' | 'dark',
  _locale: Locale,
): { theme: ThemeConfig } {
  const isDark = resolvedTheme === 'dark';
  return {
    theme: {
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: '#fafafa',
        colorBgBase: '#0a0a0a',
        colorBgContainer: '#111111',
        colorBgElevated: '#1a1a1a',
        colorBorder: '#262626',
        colorText: '#fafafa',
        colorTextSecondary: '#a1a1a1',
        colorTextTertiary: '#737373',
        borderRadius: 4,
        fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
        controlHeight: 36,
      },
      components: {
        Menu: {
          colorItemBg: 'transparent',
          colorItemBgHover: '#1a1a1a',
          colorItemBgSelected: '#fafafa',
          colorItemText: '#fafafa',
          colorItemTextHover: '#fafafa',
          colorItemTextSelected: '#0a0a0a',
          colorSubItemBg: '#0f0f0f',
        },
        Layout: {
          bodyBg: '#0a0a0a',
          headerBg: '#111111',
          triggerBg: '#1a1a1a',
        },
        Card: {
          colorBgContainer: '#111111',
          colorBorderSecondary: '#262626',
        },
        Table: {
          colorBgContainer: '#111111',
          colorBorderSecondary: '#262626',
          headerBg: '#1a1a1a',
        },
        Input: {
          colorBgContainer: '#1a1a1a',
          colorBorder: '#262626',
          activeBorderColor: '#fafafa',
          hoverBorderColor: '#525252',
        },
        Button: {
          colorBgContainer: 'transparent',
          colorBorder: '#262626',
        },
        Modal: {
          colorBgElevated: '#111111',
          colorBorder: '#262626',
        },
        Drawer: {
          colorBgElevated: '#111111',
        },
      },
    },
  };
}
