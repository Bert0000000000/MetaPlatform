import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';
import type { Locale } from 'antd/es/locale';
import { BRAND_COLORS, RADIUS, FONTS, SHADOWS } from './tokens';
import type { ResolvedTheme } from './types';

/**
 * 构造 Ant Design 6 主题配置。
 *
 * 所有 APP 在 App.tsx 中通过 ConfigProvider 注入此 theme，
 * 保证 7 个 APP 的色彩、圆角、字体等视觉风格统一。
 *
 * @param resolvedTheme 'light' | 'dark'（'system' 由调用方解析后传入）
 * @param locale        AntD locale（zhCN / enUS），可选
 */
export function getAntdTheme(
  resolvedTheme: ResolvedTheme,
  locale?: Locale,
): { theme: ThemeConfig; locale?: Locale } {
  const isDark = resolvedTheme === 'dark';
  return {
    theme: {
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: BRAND_COLORS.primary,
        colorSuccess: BRAND_COLORS.success,
        colorWarning: BRAND_COLORS.warning,
        colorError: BRAND_COLORS.error,
        colorInfo: BRAND_COLORS.info,
        borderRadius: RADIUS.base,
        borderRadiusLG: RADIUS.lg,
        borderRadiusSM: RADIUS.sm,
        fontFamily: FONTS.family,
        fontSize: FONTS.size.base,
        controlHeight: 32,
      },
      components: {
        Layout: {
          headerBg: isDark ? '#141414' : '#ffffff',
          siderBg: isDark ? '#141414' : '#ffffff',
          bodyBg: isDark ? '#0a0a0a' : '#f5f5f5',
        },
        Card: {
          boxShadowTertiary: SHADOWS.card,
        },
        Menu: {
          itemHeight: 36,
          subMenuItemBg: 'transparent',
        },
        Table: {
          headerBg: isDark ? '#1f1f1f' : '#fafafa',
          headerColor: isDark ? '#ffffffd9' : '#000000d9',
          rowHoverBg: isDark ? '#1f1f1f' : '#f5f5f5',
        },
      },
    },
    locale,
  };
}
