import { Drawer, Steps, Space, Button } from 'antd';
import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Maximize2, Minimize2, PanelRight, ArrowLeft, ArrowRight, Check } from 'lucide-react';

export type DrawerSize = 'sm' | 'md' | 'full';

interface StepDrawerProps {
  open: boolean;
  title: ReactNode;
  steps: Array<{ title: string; description?: string; content: ReactNode }>;
  onCancel: () => void;
  onFinish?: () => void;
  defaultSize?: DrawerSize;
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

export default function StepDrawer({
  open,
  title,
  steps,
  onCancel,
  onFinish,
  defaultSize = 'md',
}: StepDrawerProps) {
  const [current, setCurrent] = useState(0);
  const [size, setSize] = useState<DrawerSize>(defaultSize);

  const next = useCallback(() => {
    setCurrent((c) => Math.min(c + 1, steps.length - 1));
  }, [steps.length]);

  const prev = useCallback(() => {
    setCurrent((c) => Math.max(c - 1, 0));
  }, []);

  const cycleSize = () => {
    setSize((s) => (s === 'sm' ? 'md' : s === 'md' ? 'full' : 'sm'));
  };

  const handleFinish = () => {
    onFinish?.();
    setCurrent(0);
  };

  const handleCancel = () => {
    onCancel();
    setCurrent(0);
  };

  return (
    <Drawer
      open={open}
      title={title}
      width={SIZE_WIDTH[size]}
      onClose={handleCancel}
      destroyOnClose
      extra={
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
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            步骤 {current + 1} / {steps.length}
          </span>
          <Space>
            <Button className="v-btn" onClick={handleCancel}>
              取消
            </Button>
            {current > 0 && (
              <Button className="v-btn" icon={<ArrowLeft size={14} />} onClick={prev}>
                上一步
              </Button>
            )}
            {current < steps.length - 1 ? (
              <Button className="v-btn-primary" icon={<ArrowRight size={14} />} iconPosition="end" onClick={next}>
                下一步
              </Button>
            ) : (
              <Button className="v-btn-primary" icon={<Check size={14} />} onClick={handleFinish}>
                完成
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <Steps
        current={current}
        size="small"
        style={{ marginBottom: 24 }}
        items={steps.map((s) => ({ title: s.title, description: s.description }))}
      />
      <div style={{ minHeight: 200 }}>{steps[current]?.content}</div>
    </Drawer>
  );
}
