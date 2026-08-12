import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  Toast,
  Modal,
  Descriptions,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { SendOutlined } from '@ant-design/icons';
import { delegateA2A, listExternalAgents } from '@/api/superai/a2a';
import type { ExternalAgent } from '@/api/superai/a2a';

export default function A2ACollaborationPage() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [form] = Form.useForm();
  const [selectedAgent, setSelectedAgent] = useState<ExternalAgent | null>(null);

  useEffect(() => {
    setLoading(true);
    listExternalAgents().then((r) => {
      setAgents(r);
      setLoading(false);
    });
  }, []);

  const handleDelegate = async () => {
    if (!selectedAgent) return;
    const v = await form.validate();
    setLoading(true);
    try {
      const res = await delegateA2A(selectedAgent.agentId, v.task);
      if (res.success) {
        Toast.success('已完成');
        Modal.info({
          title: '外部 Agent 返回',
          content: res.output,
        });
      }
      setDelegateOpen(false);
      form.reset();
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnProps<ExternalAgent>[] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '能力',
      dataIndex: 'capabilities',
      render: (v: string[]) => (
        <Space>
          {v.map((c) => <Tag color="blue" key={c}>{c}</Tag>)}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => <Tag color="green">{v}</Tag>,
    },
    { title: '端点', dataIndex: 'endpoint', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      render: (_, a) => (
        <Button
          theme="borderless"
          icon={<SendOutlined />}
          onClick={() => {
            setSelectedAgent(a);
            setDelegateOpen(true);
          }}
        >
          委托
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          A2A 外部协作
        </Typography.Title>
      </div>

      <Card>
        {agents.length === 0 && !loading ? (
          <Empty description="没有可用的外部 Agent" />
        ) : (
          <Table
            rowKey="agentId"
            dataSource={agents}
            columns={columns}
            loading={loading}
            expandedRowRender={(a) => (
              a ? (
                <Descriptions
                  column={2}
                  size="small"
                  data={[
                    { key: '名称', value: a.name, span: 2 },
                    {
                      key: '能力',
                      value: <>{a.capabilities.map((c) => <Tag key={c}>{c}</Tag>)}</>,
                      span: 2,
                    },
                    { key: '端点', value: <code>{a.endpoint}</code>, span: 2 },
                  ]}
                />
              ) : null
            )}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      <Modal
        title={`委托任务给 ${selectedAgent?.name ?? ''}`}
        visible={delegateOpen}
        onCancel={() => setDelegateOpen(false)}
        onOk={handleDelegate}
        confirmLoading={loading}
      >
        <Form form={form}>
          <Form.TextArea
            field="task"
            label="任务"
            rules={[{ required: true }]}
            rows={3}
            placeholder="详细任务描述..."
          />
        </Form>
      </Modal>
    </div>
  );
}
