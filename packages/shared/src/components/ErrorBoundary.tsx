import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Result, Button, Space } from 'antd';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback render. Receives the caught error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Called when an error is caught. Useful for logging / telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Reset key — when this value changes, the boundary clears its error state. */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary that catches render-time errors anywhere in its subtree.
 * Renders a friendly Result page with a reload action by default.
 *
 * @example
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Forward to optional telemetry hook; default to console.error so traces
    // survive in dev tools without forcing a logging dependency on consumers.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error:', error, info);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error && prevProps.resetKeys !== this.props.resetKeys) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div style={{ padding: 48 }}>
        <Result
          status="error"
          title="页面发生异常"
          subTitle={error.message || '未知错误，请刷新页面或稍后重试'}
          extra={
            <Space>
              <Button type="primary" onClick={this.reset}>
                重试
              </Button>
              <Button onClick={() => window.location.reload()}>
                刷新页面
              </Button>
            </Space>
          }
        />
      </div>
    );
  }
}
