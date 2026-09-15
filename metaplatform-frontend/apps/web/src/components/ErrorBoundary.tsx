import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from '@douyinfe/semi-ui';
import './components.css';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 静默记录到 console，devtools 可见
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error, info);
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="mp-border mp-p-7 mp-text-1 mp-bg-1 mp-rounded" 
        >
          <h2 className="mp-text-danger mp-mt-1" >
            {this.props.fallbackTitle ?? "页面渲染出错"}
          </h2>
          <pre
            className="mp-border mp-p-3 mp-text-sm mp-text-2 mp-bg-fill-0 mp-rounded-sm mp-pre-wrap mp-break-word"
          >
            {String(this.state.error.message ?? this.state.error)}
          </pre>
          <Button theme="solid" type="primary" onClick={this.handleReset}>
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
