/**
 * Mate Platform 统一主题类型
 *
 * 与 APP-DASHBOARD/src/types 中的 UserSettings 对齐，
 * 所有 APP 通过 @mate/shared 共享同一份类型定义。
 */

/** 主题模式：'light' | 'dark' | 'system'。'system' 跟随操作系统 prefers-color-scheme。 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 解析后的实际主题：'system' 已被解析为 'light' | 'dark'。 */
export type ResolvedTheme = 'light' | 'dark';

/** 用户级偏好设置（仅包含主题相关的最小子集，避免与 APP-DASHBOARD 的完整 UserSettings 耦合）。 */
export interface ThemeSettings {
  theme: ThemeMode;
  language: string;
}
