import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Descriptions,
  SideSheet,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { CloseCircleOutlined } from '@ant-design/icons';
import { cancelDelegation, getDelegation, streamDelegation } from '@/api/dw/a2a';
import type { Delegation, DelegationStatus, StatusHistoryEntry } from '@/api/dw/a2a';

interface DelegationDetailDrawerProps {
  delegationId: string | null;
  onClose: () => void;
  onChange?: (delegation: Delegation) => void;
}

const STATUS_FLOW: DelegationStatus[] = ['SUBMITTED', 'WORKING', 'INPUT_REQUIRED', 'COMPLETED'];

const STATUS_LABEL: Record<string, { label: string; color: TagColor }> = {
  SUBMITTED: { label: '已提交', color: 'grey' },
  WORKING: { label: '执行中', color: 'blue' },
  INPUT_REQUIRED: { label: '需输入', color: 'orange' },
  COMPLETED: { label: '已完成', color: 'green' },
  FAILED: { label: '失败', color: 'red' },
  CANCELED: { label: '已取消', color: 'grey' },
  PENDING: { label: '待处理', color: 'grey' },
  SENT: { label: '已发送', color: 'blue' },
  IN_PROGRESS: { label: '进行中', color: 'blue' },
  CANCELLED: { label: '已取消', color: 'grey' },
};

// Timeline 圆点颜色（Semi Timeline.Item color 直接作为 CSS backgroundColor）
const TAG_TO_DOT: Record<TagColor, string> = {
  grey: 'var(--semi-color-tertiary)',
  blue: 'var(--semi-color-primary)',
  green: 'var(--semi-color-success)',
  red: 'var(--semi-color-danger)',
  orange: 'var(--semi-color-warning)',
  amber: 'var(--semi-color-warning)',
  cyan: 'var(--semi-color-primary)',
  indigo: 'var(--semi-color-primary)',
  'light-blue': 'var(--semi-color-primary)',
  'light-green': 'var(--semi-color-success)',
  lime: 'var(--semi-color-success)',
  pink: 'var(--semi-color-danger)',
  purple: 'var(--semi-color-primary)',
  teal: 'var(--semi-color-success)',
  violet: 'var(--semi-color-primary)',
  yellow: 'var(--semi-color-warning)',
  white: 'var(--semi-color-tertiary)',
};

function isTerminal(status: string): boolean {
  return ['COMPLETED', 'FAILED', 'CANCELED', 'CANCELLED'].includes(status);
}

export default function DelegationDetailDrawer({
  delegationId,
  onClose,
  onChange,
}: DelegationDetailDrawerProps) {
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [liveEvents, setLiveEvents] = useState<StatusHistoryEntry[]>([]);

  const load = async (id: string) => {
    try {
      const d = await getDelegation(id);
      setDelegation(d);
      onChange?.(d);
    } catch {
      // ignore, handled by global interceptor
    }
  };

  useEffect(() => {
    if (!delegationId) {
      setDelegation(null);
      setLiveEvents([]);
      return;
    }

    setLoading(true);
    load(delegationId).finally(() => setLoading(false));

    const interval = setInterval(() => {
      load(delegationId);
    }, 3000);

    const stopStream = streamDelegation(delegationId, {
      onProgress: (entry) => {
        setLiveEvents((prev) => [...prev, entry]);
      },
      onCompleted: () => {
        load(delegationId);
      },
      onFailed: () => {
        load(delegationId);
      },
      onCanceled: () => {
        load(delegationId);
      },
    });

    return () => {
      clearInterval(interval);
      stopStream();
    };
  }, [delegationId]);

  const currentStep = useMemo(() => {
    if (!delegation) return -1;
    if (delegation.status === 'FAILED' || delegation.status === 'CANCELED' || delegation.status === 'CANCELLED') {
      return STATUS_FLOW.length;
    }
    const idx = STATUS_FLOW.indexOf(delegation.status);
    return idx >= 0 ? idx : 0;
  }, [delegation]);

  const handleCancel = async () => {
    if (!delegationId || !delegation) return;
    setCanceling(true);
    try {
      const d = await cancelDelegation(delegationId);
      setDelegation(d);
      onChange?.(d);
      Toast.success('委托已取消');
    } finally {
      setCanceling(false);
    }
  };

  const mergedHistory = useMemo(() => {
    const base = delegation?.statusHistory || [];
    return [...base, ...liveEvents];
  }, [delegation, liveEvents]);

  return (
    <SideSheet
      title="委托详情"
      width={720}
      visible={!!delegationId}
      onCancel={onClose}
      footer={
        delegation && !isTerminal(delegation.status) ? (
          <Button
            type="danger"
            icon={<CloseCircleOutlined />}
            loading={canceling}
            onClick={handleCancel}
          >
            取消委托
          </Button>
        ) : null
      }
    >
      {loading && !delegation ? (
        <Spin tip="加载中..." />
      ) : delegation ? (
        <Space vertical spacing="loose" style={{ width: '100%' }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item itemKey="目标 Agent" span={2}>
              <Typography.Text code>{delegation.targetAgentId}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item itemKey="任务类型">{delegation.taskType}</Descriptions.Item>
            <Descriptions.Item itemKey="当前状态">
              <Tag color={STATUS_LABEL[delegation.status]?.color || 'grey'}>
                {STATUS_LABEL[delegation.status]?.label || delegation.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item itemKey="创建时间">
              {new Date(delegation.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item itemKey="完成时间">
              {delegation.completedAt ? new Date(delegation.completedAt).toLocaleString() : '-'}
            </Descriptions.Item>
          </Descriptions>

          <Steps
            current={currentStep}
            status={
              delegation.status === 'FAILED' || delegation.status === 'CANCELED' || delegation.status === 'CANCELLED'
                ? 'error'
                : 'process'
            }
          >
            <Steps.Step title="已提交" />
            <Steps.Step title="执行中" />
            <Steps.Step title="需输入" />
            <Steps.Step title="已完成" />
          </Steps>

          <div>
            <Typography.Title heading={5}>状态时间线</Typography.Title>
            <Timeline>
              {mergedHistory.map((h, idx) => (
                <Timeline.Item
                  key={idx}
                  color={TAG_TO_DOT[STATUS_LABEL[h.status]?.color || 'blue']}
                >
                  <Space vertical spacing={0}>
                    <Tag color={STATUS_LABEL[h.status]?.color || 'grey'}>
                      {STATUS_LABEL[h.status]?.label || h.status}
                    </Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(h.timestamp).toLocaleString()}
                    </Typography.Text>
                    {h.detail ? (
                      <Typography.Text style={{ fontSize: 13 }}>{h.detail}</Typography.Text>
                    ) : null}
                  </Space>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>

          {delegation.status === 'COMPLETED' && delegation.result && (
            <div>
              <Typography.Title heading={5}>执行结果</Typography.Title>
              <pre style={{ background: 'var(--muted)', padding: 12, borderRadius: 8, overflow: 'auto' }}>
                {JSON.stringify(delegation.result, null, 2)}
              </pre>
            </div>
          )}

          {(delegation.status === 'FAILED' || delegation.status === 'CANCELED' || delegation.status === 'CANCELLED') &&
            delegation.error && (
              <div>
                <Typography.Title heading={5}>错误信息</Typography.Title>
                <Typography.Text type="danger">{delegation.error}</Typography.Text>
              </div>
            )}
        </Space>
      ) : (
        <Typography.Text type="secondary">未找到委托</Typography.Text>
      )}
    </SideSheet>
  );
}
