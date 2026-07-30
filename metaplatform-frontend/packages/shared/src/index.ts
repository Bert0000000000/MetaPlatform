// P4 interaction, renderer, and built-in icon APIs.
export * from './interaction/InteractionContextProvider';
export * from './renderers/ClaimRenderer';
export * from './renderers/EvidenceRenderer';
export * from './renderers/ArtifactViewer';
export * from './interaction/SuperAIApi';
export * from './icons';

export { default as ErrorBoundary } from './ErrorBoundary';
export { default as PlatformMenu, NAV_ITEMS, type NavItem } from './PlatformMenu';
export { default as AppLayout } from './AppLayout';
export { AuthProvider, useAuth, type AuthContextValue } from './auth/AuthProvider';
export { AuthGuard } from './auth/AuthGuard';
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

export { default as PageContainer } from './components/PageContainer';
export { default as SectionCard } from './components/SectionCard';
export { default as SearchInput } from './components/SearchInput';
export { default as DataTable } from './components/DataTable';
export { default as FormModal } from './components/FormModal';
export { default as FormDrawer, type DrawerSize } from './components/FormDrawer';
export { default as StepDrawer, type DrawerSize as StepDrawerSize } from './components/StepDrawer';
export { Field, TextInput, TextArea, Select, FormSection, TagInput } from './components/FormFields';

export { default as PageLoading } from './components/PageLoading';
export { default as CardSkeleton } from './components/CardSkeleton';
export { default as InlineLoading } from './components/InlineLoading';
export { default as ErrorState } from './components/ErrorState';
export { default as EmptyState } from './components/EmptyState';
export { default as SharedLoginPage } from './components/SharedLoginPage';
export { default as MateLogo, MateBrand, type MateLogoProps, type MateBrandProps, type MateLogoVariant } from './components/MateLogo';
export { default as StateContainer } from './components/StateContainer';
export { default as PageHeader } from './components/PageHeader';
export { default as ScrollbarAutoHide } from './components/ScrollbarAutoHide';
export { default as SubTabs, type SubTabItem } from './components/SubTabs';
export { default as Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from './components/Breadcrumb';

export { useThemeMode, getAntdTheme } from './theme';
export * as FlowCanvas from './components/flow';
export * as Api from './api';
export { isApiError, isBizError, isHttpError } from './api/errors';
export type { BizError, HttpError } from './api/errors';
export { useAsyncError } from './errors';
export { useApiErrorBoundary, type NormalizedError } from './hooks/useApiErrorBoundary';
export { useAsync } from './hooks/useAsync';
export { useCachedAsync, type UseCachedAsyncOptions, type UseCachedAsyncResult } from './hooks/useCachedAsync';
export { useWebSocket, type UseWebSocketOptions, type UseWebSocketResult, type WsMessage } from './hooks/useWebSocket';
export { useLoadingState } from './hooks/useLoadingState';
export {
  formatDateTime,
  formatDate,
  formatTime,
  formatRelative,
  type DateTimeSettings,
} from './utils/datetime';

import './global.css';
export * from './components/assistant';

