/**
 * V12-08: 实现已迁移到 @mate/shared，本文件仅做 re-export 以保持向后兼容。
 */
export {
  PageLoading,
  CardSkeleton,
  InlineLoading,
  ErrorState,
  EmptyState,
  StateContainer,
  PageHeader,
} from './StateViews';
export { ErrorBoundary } from './ErrorBoundary';
// V12-08: 同时暴露新增的统一组件，方便 APP-DASHBOARD 内部逐步迁移。
export {
  PageContainer,
  SectionCard,
  SearchInput,
  DataTable,
  FormModal,
} from '@mate/shared';
