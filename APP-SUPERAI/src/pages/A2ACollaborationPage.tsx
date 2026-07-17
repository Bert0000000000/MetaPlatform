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
  message,
  Modal,
  Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { GlobalOutlined, SendOutlined } from '@ant-design/icons';
import { delegateA2A, listExternalAgents } from '@/api/a2a';
import type { ExternalAgent } from '@/api/a2a';

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
    const v = await form.validateFields();
    setLoading(true);
    try {
      const res = await delegateA2A(selectedAgent.agentId, v.task);
      if (res.success) {
        message.success('已完成');
        Modal.info({
          title: '外部 Agent 返回',
          content: res.output,
        });
      }
      setDelegateOpen(false);
      form.resetFields();
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<ExternalAgent> = [
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
          type="link"
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
        <Typography.Title level={4} style={{ margin: 0 }}>
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
            expandable={{
              expandedRowRender: (a) => (
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="名称" span={2}>{a.name}</Descriptions.Item>
                  <Descriptions.Item label="能力" span={2}>
                    {a.capabilities.map((c) => <Tag key={c}>{c}</Tag>)}
                  </Descriptions.Item>
                  <Descriptions.Item label="端点" span={2}>
                    <code>{a.endpoint}</code>
                  </Descriptions.Item>
                </Descriptions>
              ),
            }}
          />
        )}
      </Card>

      <Modal
        title={`委托任务给 ${selectedAgent?.name ?? ''}`}
        open={delegateOpen}
        onCancel={() => setDelegateOpen(false)}
        onOk={handleDelegate}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="task" label="任务" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="详细任务描述..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
