import { ReactNode } from 'react';
import { Card } from 'antd';

interface SectionCardProps {
  /** 卡片标题 */
  title?: ReactNode;
  /** 右上角操作区 */
  extra?: ReactNode;
  /** 卡片内容 */
  children?: ReactNode;
  /** 是否去掉默认 padding（用于内嵌表格等紧贴场景） */
  bodyPadding?: number | string;
  /** 额外样式 */
  style?: React.CSSProperties;
  /** 卡片尺寸 */
  size?: 'default' | 'small';
}

/**
 * 统一的区块卡片：标准 AntD Card 的封装，用于在页面内分割多个内容区。
 *
 * 与裸 Card 的区别：
 * - 默认 body padding 与设计 token 对齐（24px）
 * - 提供更直观的 size / bodyPadding 接口
 * - 各 APP 不再各自定义 Card 样式
 *
 * @example
 * <SectionCard title="基本信息" extra={<Button>编辑</Button>}>
 *   <Descriptions ... />
 * </SectionCard>
 */
export function SectionCard({
  title,
  extra,
  children,
  bodyPadding = 24,
  style,
  size = 'default',
}: SectionCardProps) {
  return (
    <Card
      title={title}
      extra={extra}
      size={size}
      style={style}
      styles={{ body: { padding: bodyPadding } }}
    >
      {children}
    </Card>
  );
}
