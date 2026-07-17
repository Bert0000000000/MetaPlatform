import { useState } from 'react';
import type { ReactNode } from 'react';
import { Timeline, Tag, Typography, Space, Card, Alert, Steps, Tabs, Form, Input, Select, Button, message } from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BranchesOutlined,
  FlagOutlined,
  ForwardOutlined,
} from '@ant-design/icons';
import type { FlowTestResult, FlowTestStep } from '@/types';

interface FlowTestPanelProps {
  result: FlowTestResult;
}

const ACTION_ICONS: Record<FlowTestStep['action'], ReactNode> = {
  submit: <PlayCircleOutlined style={{ color: '#1677ff' }} />,
  approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  reject: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
  condition_check: <BranchesOutlined style={{ color: '#faad14' }} />,
  complete: <FlagOutlined style={{ color: '#722ed1' }} />,
};

const NODE_TYPE_TAGS: Record<string, { color: string; label: string }> = {
  start: { color: 'green', label: '开始' },
  approval: { color: 'blue', label: '审批' },
  condition: { color: 'orange', label: '条件' },
  end: { color: 'red', label: '结束' },
};

export default function FlowTestPanel({ result }: FlowTestPanelProps) {
  const finalStatusType = result.finalStatus === 'approved' ? 'success' : result.finalStatus === 'rejected' ? 'error' : 'warning';
  const [approver, setApprover] = useState('userA');
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');

  return (
    <Tabs
      items={[
        {
          key: 'trace',
          label: '执行轨迹',
          children: (
            <div>
              <Alert
                type={finalStatusType}
                message={
                  result.finalStatus === 'approved'
                    ? '流程测试通过 ✅'
                    : result.finalStatus === 'rejected'
                      ? '流程测试被拒绝 ❌'
                      : '流程测试异常 ⚠️'
                }
                description={`共 ${result.steps.length} 步，耗时 ${result.duration}ms`}
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Steps
                size="small"
                current={result.steps.length - 1}
                direction="vertical"
                items={result.steps.map((step) => ({
                  title: (
                    <Space>
                      <Typography.Text strong>{step.nodeName}</Typography.Text>
                      <Tag color={NODE_TYPE_TAGS[step.nodeType]?.color}>
                        {NODE_TYPE_TAGS[step.nodeType]?.label}
                      </Tag>
                    </Space>
                  ),
                  description: (
                    <Space direction="vertical" size="small">
                      <Space>
                        {ACTION_ICONS[step.action]}
                        <Typography.Text>{step.actionLabel}</Typography.Text>
                      </Space>
                      {step.assignee && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          审批人：{step.assignee}
                        </Typography.Text>
                      )}
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(step.timestamp).toLocaleString()}
                      </Typography.Text>
                    </Space>
                  ),
                  status: 'finish',
                }))}
              />
            </div>
          ),
        },
        {
          key: 'simulate',
          label: '模拟推进',
          children: (
            <Card>
              <Form layout="vertical" style={{ maxWidth: 480 }}>
                <Form.Item label="模拟审批人">
                  <Select
                    value={approver}
                    onChange={setApprover}
                    options={[
                      { label: 'userA - 张三', value: 'userA' },
                      { label: 'userB - 李四', value: 'userB' },
                      { label: 'userC - 王五', value: 'userC' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="决策">
                  <Select
                    value={decision}
                    onChange={(v) => setDecision(v as 'approve' | 'reject')}
                    options={[
                      { label: '同意', value: 'approve' },
                      { label: '拒绝', value: 'reject' },
                      { label: '转交', value: 'approve' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="附加意见">
                  <Input.TextArea rows={3} placeholder="审批意见..." />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    icon={<ForwardOutlined />}
                    onClick={() => message.info('已模拟一步')}
                  >
                    下一步
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          ),
        },
      ]}
    />
  );
}
