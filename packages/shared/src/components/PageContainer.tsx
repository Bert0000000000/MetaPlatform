import { ReactNode } from 'react';
import { Space, Typography } from 'antd';
import { PageHeader } from './StateViews';

interface PageContainerProps {
  /** 主标题 */
  title?: string;
  /** 副标题 / 说明文字 */
  subtitle?: ReactNode;
  /** 右上角操作区（按钮、搜索等） */
  extra?: ReactNode;
  /** 顶部筛选/工具栏区（在 PageHeader 下方独立一行） */
  toolbar?: ReactNode;
  /** 主体内容 */
  children?: ReactNode;
  /** 是否去掉默认的 marginBottom（用于自定义布局） */
  noHeaderMargin?: boolean;
}

/**
 * 统一的页面容器：PageHeader + 可选 toolbar + 主体内容。
 *
 * 用于替代各 APP 中重复的 `<div><Typography.Title>...</Typography.Title>...</div>` 模板。
 *
 * @example
 * <PageContainer
 *   title="数字员工"
 *   subtitle="管理所有 AI 数字员工"
 *   extra={<Button type="primary">创建</Button>}
 *   toolbar={<SearchInput placeholder="搜索员工" onSearch={setKeyword} />}
 * >
 *   <EmployeeList />
 * </PageContainer>
 */
export function PageContainer({
  title,
  subtitle,
  extra,
  toolbar,
  children,
  noHeaderMargin,
}: PageContainerProps) {
  const showHeader = Boolean(title || extra);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: noHeaderMargin ? 0 : 16 }}>
      {showHeader && <PageHeader title={title ?? ''} subtitle={typeof subtitle === 'string' ? subtitle : undefined} extra={extra} />}
      {subtitle && typeof subtitle !== 'string' && (
        <Typography.Text type="secondary" style={{ marginTop: -8, fontSize: 13 }}>
          {subtitle}
        </Typography.Text>
      )}
      {toolbar && <Space wrap style={{ marginBottom: 0 }}>{toolbar}</Space>}
      <div>{children}</div>
    </div>
  );
}
