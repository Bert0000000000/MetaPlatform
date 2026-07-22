/**
 * Mate Platform 共享包：跨 7 个 APP 的统一设计 token、主题、基础组件、hooks、utils。
 *
 * 引用方式（在任意 APP 内）：
 *   import { PageContainer, StateContainer, useAsync, tokens } from '@mate/shared';
 *   import { ErrorBoundary } from '@mate/shared/components';
 *
 * 所有 APP 通过 vite alias `@mate/shared` 指向 `packages/shared`，
 * TS 路径映射通过 `@mate/shared/*` 在 tsconfig.app.json 中配置。
 */

export * from './tokens';
export * from './theme';
export * from './useThemeMode';
export * from './types';
export * from './components';
export * from './hooks';
export * from './utils';

// === 统一认证（消除二次登录） ===
export {
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  removeToken,
  getUser,
  setUser,
  getTenantId,
  isLoggedIn,
  type AuthUser,
} from './auth/token';
export { AuthProvider, useAuth } from './auth/AuthProvider';
export { AuthGuard } from './auth/AuthGuard';

export { PLATFORM_MENU, type PlatformMenuItem } from './config/platformMenu';
export { PlatformMenu, type PlatformMenuProps } from './components/PlatformMenu';
export { findActiveMenu, resolveMenuHref, type ActiveMenuResult } from './utils/menuMatcher';
