import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Descriptions,
  Drawer,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';
import { cancelDelegation, getDelegation, streamDelegation } from '@/api/a2a';
import type { Delegation, DelegationStatus, StatusHistoryEntry } from '@/api/a2a';

interface DelegationDetailDrawerProps {
  delegationId: string | null;
  onClose: () => void;
  onChange?: (delegation: Delegation) => void;
}

const STATUS_FLOW: DelegationStatus[] = ['SUBMITTED', 'WORKING', 'INPUT_REQUIRED', 'COMPLETED'];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: '已提交', color: 'default' },
  WORKING: { label: '执行中', color: 'processing' },
  INPUT_REQUIRED: { label: '需输入', color: 'warning' },
  COMPLETED: { label: '已完成', color: 'success' },
  FAILED: { label: '失败', color: 'error' },
  CANCELED: { label: '已取消', color: 'default' },
  PENDING: { label: '待处理', color: 'default' },
  SENT: { label: '已发送', color: 'processing' },
  IN_PROGRESS: { label: '进行中', color: 'processing' },
  CANCELLED: { label: '已取消', color: 'default' },
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
      message.success('委托已取消');
    } finally {
      setCanceling(false);
    }
  };

  const mergedHistory = useMemo(() => {
    const base = delegation?.statusHistory || [];
    return [...base, ...liveEvents];
  }, [delegation, liveEvents]);

  return (
    <Drawer
      title="委托详情"
      width={720}
      open={!!delegationId}
      onClose={onClose}
      footer={
        delegation && !isTerminal(delegation.status) ? (
          <Button
            danger
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
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="目标 Agent" span={2}>
              <Typography.Text code>{delegation.targetAgentId}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="任务类型">{delegation.taskType}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={STATUS_LABEL[delegation.status]?.color || 'default'}>
                {STATUS_LABEL[delegation.status]?.label || delegation.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(delegation.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
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
            items={[
              { title: '已提交' },
              { title: '执行中' },
              { title: '需输入' },
              { title: '已完成' },
            ]}
          />

          <div>
            <Typography.Title level={5}>状态时间线</Typography.Title>
            <Timeline
              items={mergedHistory.map((h) => ({
                color: STATUS_LABEL[h.status]?.color || 'blue',
                children: (
                  <Space direction="vertical" size={0}>
                    <Tag color={STATUS_LABEL[h.status]?.color || 'default'}>
                      {STATUS_LABEL[h.status]?.label || h.status}
                    </Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(h.timestamp).toLocaleString()}
                    </Typography.Text>
                    {h.detail ? (
                      <Typography.Text style={{ fontSize: 13 }}>{h.detail}</Typography.Text>
                    ) : null}
                  </Space>
                ),
              }))}
            />
          </div>

          {delegation.status === 'COMPLETED' && delegation.result && (
            <div>
              <Typography.Title level={5}>执行结果</Typography.Title>
              <pre style={{ background: '#f6f6f6', padding: 12, borderRadius: 8, overflow: 'auto' }}>
                {JSON.stringify(delegation.result, null, 2)}
              </pre>
            </div>
          )}

          {(delegation.status === 'FAILED' || delegation.status === 'CANCELED' || delegation.status === 'CANCELLED') &&
            delegation.error && (
              <div>
                <Typography.Title level={5}>错误信息</Typography.Title>
                <Typography.Text type="danger">{delegation.error}</Typography.Text>
              </div>
            )}
        </Space>
      ) : (
        <Typography.Text type="secondary">未找到委托</Typography.Text>
      )}
    </Drawer>
  );
}
