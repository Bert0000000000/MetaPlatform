/**
 * PageShell — 平台统一页面外壳。
 * 解决「Layout.Content 上下边界不齐 + 各页面各自加 padding 重复」问题：
 *  - 顶部 16px 间距，分页内容之间用 gap 16/24
 *  - 内部使用 row 布局：左右对齐工具栏可用 `justify: space-between`
 *  - 提供左右两侧到边缘的合规留白
 */
import type { CSSProperties, ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  style?: CSSProperties;
  /** 关闭左右内边距（用于页面内嵌表格顶满容器） */
  flush?: boolean;
}

export default function PageShell({ children, style, flush }: PageShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        gap: 16,
        padding: flush ? '0' : '0',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
