import type { ReactNode, CSSProperties } from 'react';

export interface PageRootProps {
  children: ReactNode;
  /**
   * 可选 sticky 头部（如 SubTabs 行、AI 助手 trigger）。
   * 不传则 children 直接进入下方可滚动内容区。
   */
  header?: ReactNode;
  /** 外层 style 覆盖；少数页面需要 padding/wrap 调整时使用 */
  style?: CSSProperties;
}

/**
 * 所有页面在 AppLayout.Content 内的根容器。
 *
 * AppLayout.Content 提供：padding: 8px / overflow: auto / display: flex / flexDirection: column / flex: 1 / minHeight: 0。
 * PageRoot 在此基础上给页面一个标准的"flex column 容器 + 可选 sticky 头部 + 可滚动内容区"结构，
 * 让所有页面的层级关系保持一致 —— 未来 Content 的 padding / overflow 改了，只动 PageRoot 即可。
 *
 * 关键约束：PageRoot 本身不引入 padding。需要内边距时在 children 自己加（避免 AppLayout padding 一改
 * 就和子元素的负 margin hack 打架）。
 */
export default function PageRoot({ children, header, style }: PageRootProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        ...style,
      }}
    >
      {header}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}