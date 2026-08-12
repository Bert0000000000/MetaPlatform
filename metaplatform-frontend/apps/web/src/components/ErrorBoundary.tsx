import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@douyinfe/semi-ui";

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
          style={{
            padding: 32,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
        >
          <h2 style={{ marginTop: 0, color: "var(--destructive)" }}>
            {this.props.fallbackTitle ?? "页面渲染出错"}
          </h2>
          <pre
            style={{
              fontSize: 12,
              padding: 12,
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "var(--muted-foreground)",
            }}
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
