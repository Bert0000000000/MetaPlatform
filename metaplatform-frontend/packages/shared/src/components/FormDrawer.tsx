import { SideSheet, Space, Button } from '@douyinfe/semi-ui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Maximize2, Minimize2, PanelRight } from 'lucide-react';

export type DrawerSize = 'sm' | 'md' | 'full';

interface FormDrawerProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onCancel: () => void;
  onOk?: () => void;
  okText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  footer?: ReactNode;
  size?: DrawerSize;
  defaultSize?: DrawerSize;
  onSizeChange?: (size: DrawerSize) => void;
}

const SIZE_WIDTH: Record<DrawerSize, string | number> = {
  sm: '33.333%',
  md: '66.666%',
  full: '100%',
};

const SIZE_TITLE: Record<DrawerSize, string> = {
  sm: '1/3 屏',
  md: '2/3 屏',
  full: '全屏',
};

export default function FormDrawer({
  open,
  title,
  children,
  onCancel,
  onOk,
  okText = '确认',
  cancelText = '取消',
  confirmLoading,
  footer,
  size: controlledSize,
  defaultSize = 'md',
  onSizeChange,
}: FormDrawerProps) {
  const [internalSize, setInternalSize] = useState<DrawerSize>(defaultSize);
  const size = controlledSize ?? internalSize;

  const cycleSize = () => {
    const next: DrawerSize = size === 'sm' ? 'md' : size === 'md' ? 'full' : 'sm';
    if (controlledSize == null) {
      setInternalSize(next);
    }
    onSizeChange?.(next);
  };

  return (
    <SideSheet
      visible={open}
      width={SIZE_WIDTH[size]}
      onCancel={onCancel}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>{title}</span>
          <button
            type="button"
            onClick={cycleSize}
            title={`切换尺寸：${SIZE_TITLE[size]}`}
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
            }}
          >
            {size === 'sm' ? <PanelRight size={14} /> : size === 'md' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>
      }
      footer={
        footer ?? (
          <Space>
            <Button theme="borderless" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button theme="solid" type="primary" loading={confirmLoading} onClick={onOk}>
              {okText}
            </Button>
          </Space>
        )
      }
    >
      {children}
    </SideSheet>
  );
}
