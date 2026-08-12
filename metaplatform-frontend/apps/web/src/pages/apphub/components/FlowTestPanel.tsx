import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Tag,
  Typography,
  Space,
  Card,
  Banner,
  Steps,
  Tabs,
  Form,
  Input,
  Select,
  Button,
  Toast,
  TextArea,
} from '@douyinfe/semi-ui';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BranchesOutlined,
  FlagOutlined,
  ForwardOutlined,
} from '@ant-design/icons';
import type { FlowTestResult, FlowTestStep } from '@/api/apphub/types';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';

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

const NODE_TYPE_TAGS: Record<string, { color: TagColor; label: string }> = {
  start: { color: 'green', label: '开始' },
  approval: { color: 'blue', label: '审批' },
  condition: { color: 'orange', label: '条件' },
  end: { color: 'red', label: '结束' },
};

export default function FlowTestPanel({ result }: FlowTestPanelProps) {
  const finalStatusType: 'success' | 'danger' | 'warning' =
    result.finalStatus === 'approved'
      ? 'success'
      : result.finalStatus === 'rejected'
        ? 'danger'
        : 'warning';
  const [approver, setApprover] = useState('userA');
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');

  return (
    <Tabs>
      <Tabs.TabPane tab="执行轨迹" itemKey="trace">
        <div>
          <Banner
            type={finalStatusType}
            title={
              result.finalStatus === 'approved'
                ? '流程测试通过 ✅'
                : result.finalStatus === 'rejected'
                  ? '流程测试被拒绝 ❌'
                  : '流程测试异常 ⚠️'
            }
            description={`共 ${result.steps.length} 步，耗时 ${result.duration}ms`}
            icon={null}
            style={{ marginBottom: 16 }}
          />

          <Steps
            size="small"
            current={result.steps.length - 1}
            direction="vertical"
           type="basic">
            {result.steps.map((step, idx) => (
              <Steps.Step
                key={`${step.nodeName}-${idx}`}
                status="finish"
                title={
                  <Space>
                    <Typography.Text strong>{step.nodeName}</Typography.Text>
                    <Tag color={NODE_TYPE_TAGS[step.nodeType]?.color}>
                      {NODE_TYPE_TAGS[step.nodeType]?.label}
                    </Tag>
                  </Space>
                }
                description={
                  <Space vertical spacing="tight">
                    <Space>
                      {ACTION_ICONS[step.action]}
                      <Typography.Text>{step.actionLabel}</Typography.Text>
                    </Space>
                    {step.assignee && (
                      <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                        审批人：{step.assignee}
                      </Typography.Text>
                    )}
                    <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                      {new Date(step.timestamp).toLocaleString()}
                    </Typography.Text>
                  </Space>
                }
              />
            ))}
          </Steps>
        </div>
      </Tabs.TabPane>
      <Tabs.TabPane tab="模拟推进" itemKey="simulate">
        <Card>
          <div style={{ maxWidth: 480 }}>
            <Form.Slot label="模拟审批人">
              <Select
                value={approver}
                onChange={(v) => setApprover(typeof v === 'string' ? v : 'userA')}
                optionList={[
                  { label: 'userA - 张三', value: 'userA' },
                  { label: 'userB - 李四', value: 'userB' },
                  { label: 'userC - 王五', value: 'userC' },
                ]}
              />
            </Form.Slot>
            <Form.Slot label="决策">
              <Select
                value={decision}
                onChange={(v) => setDecision(v as 'approve' | 'reject')}
                optionList={[
                  { label: '同意', value: 'approve' },
                  { label: '拒绝', value: 'reject' },
                  { label: '转交', value: 'approve' },
                ]}
              />
            </Form.Slot>
            <Form.Slot label="附加意见">
              <TextArea rows={3} placeholder="审批意见..." />
            </Form.Slot>
            <div style={{ marginTop: 8 }}>
              <Button
                type="primary"
                icon={<ForwardOutlined />}
                onClick={() => Toast.info('已模拟一步')}
              >
                下一步
              </Button>
            </div>
          </div>
        </Card>
      </Tabs.TabPane>
    </Tabs>
  );
}
