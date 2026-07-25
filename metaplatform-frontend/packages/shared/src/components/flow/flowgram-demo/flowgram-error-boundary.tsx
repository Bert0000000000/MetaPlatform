/**
 * FlowGram ErrorBoundary
 * --------------------------------------------------
 * 兜底 FlowGram 内部错误（如 InversifyJS DI 绑定缺失），不让整页白屏。
 * 业务侧仍能继续看到除 FlowGram 之外的其他 UI。
 *
 * 创建于 2026-07-25，v1.4 R1.5 Sprint 1。
 */
import React from 'react';

interface Props {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FlowgramErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[FlowgramErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 400,
            padding: 32,
            background: 'var(--card)',
            border: '1px dashed var(--destructive)',
            borderRadius: 'var(--radius)',
            color: 'var(--foreground)',
            fontSize: 13,
            textAlign: 'center',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--destructive)' }}>
            画布渲染失败
          </div>
          <div style={{ color: 'var(--muted-foreground)', maxWidth: 480, lineHeight: 1.6 }}>
            FlowGram.AI 编辑器内部初始化错误（{this.state.error?.message ?? '未知错误'}）。
            请检查 Free-layout / Fixed-layout 依赖与 InversifyJS DI 绑定是否一致。
          </div>
          <button
            className="v-btn"
            style={{ marginTop: 8 }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default FlowgramErrorBoundary;