import { SideSheet } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';

export interface SheetDetailProps {
  title: ReactNode;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  /** 默认取平台布局令牌 --mp-sheet-w（= 456px，DESIGN-SPEC §5 B 版式） */
  width?: number | string;
  className?: string;
}

/**
 * SheetDetail —— 详情 Preview Sheet（Foundry Selection Preview 范式，DESIGN-SPEC §5）。
 * 非模态：mask=false，打开时表格仍可继续操作；Esc 关闭；渲染在应用壳容器内。
 * 基于 Semi SideSheet，不自绘浮层。
 */
export default function SheetDetail({
  title,
  open,
  onClose,
  children,
  footer,
  width = 'var(--mp-sheet-w)',
  className,
}: SheetDetailProps) {
  return (
    <SideSheet
      className={className ? `mp-sheet ${className}` : 'mp-sheet'}
      title={title}
      visible={open}
      onCancel={onClose}
      placement="right"
      width={width}
      mask={false}
      closeOnEsc
      footer={footer}
      getPopupContainer={() => document.getElementById('app') ?? document.body}
    >
      <div className="mp-sheet-body">{children}</div>
    </SideSheet>
  );
}
