import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Form,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ThunderboltOutlined } from '@ant-design/icons';
import { detectIntent, listIntentHistory } from '@/api/schedule';
import type { ScheduleIntent } from '@/api/schedule';

export default function ScheduleIntentPage() {
  const [intents, setIntents] = useState<ScheduleIntent[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setIntents(await listIntentHistory());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDetect = async () => {
    if (!text.trim()) {
      message.warning('请输入');
      return;
    }
    setSubmitting(true);
    try {
      const i = await detectIntent(text);
      setText('');
      message.success(`识别为 ${i.detectedIntent}, 置信度 ${(i.confidence * 100).toFixed(0)}%`);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ScheduleIntent> = [
    {
      title: '原话',
      dataIndex: 'rawUtterance',
      ellipsis: true,
    },
    {
      title: '识别结果',
      dataIndex: 'detectedIntent',
      render: (v) => (
        <Tag color={v === 'scheduled' ? 'blue' : 'green'}>
          {v === 'scheduled' ? '定时' : '即时'}
        </Tag>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      render: (v) => `${(v * 100).toFixed(1)}%`,
    },
    {
      title: '匹配员工',
      dataIndex: 'detectedEmployees',
      render: (v: string[]) => (
        <Space>
          {v.map((e) => <Tag key={e} color="purple">{e}</Tag>)}
        </Space>
      ),
    },
    {
      title: '匹配时间',
      dataIndex: 'matchedAt',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>调度意图识别</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="输入一句话">
            <Input.TextArea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例如：每周一早上发邮件给我本周团队数据..."
            />
          </Form.Item>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={submitting}
            onClick={handleDetect}
          >
            识别
          </Button>
        </Form>
      </Card>

      <Card title="历史记录">
        {intents.length === 0 && !loading ? (
          <Empty description="还没有历史" />
        ) : (
          <Table rowKey="intentId" dataSource={intents} columns={columns} loading={loading} scroll={{ x: 'max-content' }} />
        )}
      </Card>
    </div>
  );
}
