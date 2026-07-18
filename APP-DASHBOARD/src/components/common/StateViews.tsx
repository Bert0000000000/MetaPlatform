import { ReactNode } from 'react';
import { Result, Button, Spin, Skeleton, Empty, Typography, Space } from 'antd';
import { ReloadOutlined, InboxOutlined } from '@ant-design/icons';

/**
 * Full-page loading spinner with optional tip.
 * Use for initial page load or route transitions.
 */
export function PageLoading({ tip = '加载中...' }: { tip?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320, padding: 48 }}>
      <Spin size="large" tip={tip}>
        <div style={{ padding: 32 }} />
      </Spin>
    </div>
  );
}

/**
 * Card-level loading skeleton. Use inside cards/panels while fetching data.
 * Pass `rows` to control how many skeleton rows to render.
 */
export function CardSkeleton({ rows = 3, avatar = false }: { rows?: number; avatar?: boolean }) {
  return <Skeleton avatar={avatar} active paragraph={{ rows }} />;
}

/**
 * Inline loading spinner for small areas (buttons, list items, table cells).
 */
export function InlineLoading({ tip }: { tip?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <Spin tip={tip} />
    </div>
  );
}

interface ErrorStateProps {
  /** Error message to display. If an Error object is passed, its message is used. */
  error?: Error | string | null;
  /** Optional title override. Defaults to "加载失败". */
  title?: string;
  /** Retry callback. When provided, a "重试" button is shown. */
  onRetry?: () => void;
  /** Optional extra actions rendered alongside the retry button. */
  extra?: ReactNode;
  /** Compact mode: renders inside a card-friendly area instead of full-height. */
  compact?: boolean;
}

/**
 * Unified error state with optional retry. Use anywhere an API call failed.
 */
export function ErrorState({ error, title = '加载失败', onRetry, extra, compact }: ErrorStateProps) {
  const subtitle =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '发生未知错误，请稍后重试';

  const actions = (
    <Space>
      {onRetry && (
        <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
          重试
        </Button>
      )}
      {extra}
    </Space>
  );

  const body = (
    <Result
      status="error"
      title={title}
      subTitle={subtitle}
      extra={actions}
    />
  );

  if (compact) {
    return <div style={{ padding: 24 }}>{body}</div>;
  }
  return body;
}

interface EmptyStateProps {
  /** Optional title. Defaults to "暂无数据". */
  description?: ReactNode;
  /** Optional CTA button text. */
  actionText?: string;
  /** CTA click handler. */
  onAction?: () => void;
  /** Use custom icon (defaults to Empty default). */
  icon?: ReactNode;
}

/**
 * Unified empty state. Use for lists, tables, search results with no data.
 */
export function EmptyState({ description = '暂无数据', actionText, onAction, icon }: EmptyStateProps) {
  return (
    <Empty
      image={icon ? undefined : undefined}
      description={description}
      style={{ padding: 32 }}
    >
      {actionText && onAction && (
        <Button type="primary" icon={<InboxOutlined />} onClick={onAction}>
          {actionText}
        </Button>
      )}
    </Empty>
  );
}

/**
 * Container that switches between loading / error / empty / children states.
 * Reduces boilerplate for data-driven panels.
 *
 * @example
 * <StateContainer loading={isLoading} error={error} isEmpty={list.length === 0} onRetry={reload}>
 *   <List items={list} />
 * </StateContainer>
 */
interface StateContainerProps {
  loading?: boolean;
  error?: Error | string | null;
  isEmpty?: boolean;
  emptyDescription?: ReactNode;
  emptyActionText?: string;
  onEmptyAction?: () => void;
  onRetry?: () => void;
  /** Skeleton rows for loading state. 0 = spinner. */
  skeletonRows?: number;
  children?: ReactNode;
}

export function StateContainer({
  loading,
  error,
  isEmpty,
  emptyDescription,
  emptyActionText,
  onEmptyAction,
  onRetry,
  skeletonRows = 0,
  children,
}: StateContainerProps) {
  if (loading) {
    return skeletonRows > 0 ? <CardSkeleton rows={skeletonRows} /> : <InlineLoading />;
  }
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} compact />;
  }
  if (isEmpty) {
    return <EmptyState description={emptyDescription} actionText={emptyActionText} onAction={onEmptyAction} />;
  }
  return <>{children}</>;
}

/**
 * Section header for pages with title + optional extra actions.
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}

export function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {extra && <Space>{extra}</Space>}
    </div>
  );
}
