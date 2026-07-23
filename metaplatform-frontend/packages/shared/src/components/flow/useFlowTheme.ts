/**
 * useFlowTheme
 * --------------------------------------------------
 * 解析当前主题（light/dark/auto → light/dark）并同步 CSS 变量。
 * auto 时跟随 useThemeMode().resolvedTheme。
 */

import { useEffect, useMemo } from 'react';
import { useThemeMode } from '../../theme';
import {
  applyFlowThemeVars,
  getFlowSemanticTheme,
  type FlowSemanticTheme,
} from './flow-canvas-tokens';
import type { ResolvedThemeMode, ThemeModeSetting } from './flow-types';

export interface UseFlowThemeResult {
  themeMode: ThemeModeSetting;
  resolvedMode: ResolvedThemeMode;
  theme: FlowSemanticTheme;
}

export function useFlowTheme(setting: ThemeModeSetting = 'auto'): UseFlowThemeResult {
  const { resolvedTheme } = useThemeMode();

  const resolvedMode: ResolvedThemeMode =
    setting === 'auto' ? (resolvedTheme === 'light' ? 'light' : 'dark') : setting;

  const theme = useMemo(() => getFlowSemanticTheme(resolvedMode), [resolvedMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    applyFlowThemeVars(document.documentElement, resolvedMode);
  }, [resolvedMode]);

  return { themeMode: setting, resolvedMode, theme };
}
