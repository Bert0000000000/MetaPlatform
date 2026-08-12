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
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { ThunderboltOutlined } from '@ant-design/icons';
import { detectIntent, listIntentHistory } from '@/api/superai/schedule';
import type { ScheduleIntent } from '@/api/superai/schedule';

export default function ScheduleIntentPage() {
  const [intents, setIntents] = useState<ScheduleIntent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

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
    const text = String(form.getValues().intentText ?? '');
    if (!text.trim()) {
      Toast.warning('请输入');
      return;
    }
    setSubmitting(true);
    try {
      const i = await detectIntent(text);
      form.setValue('intentText', '');
      Toast.success(`识别为 ${i.detectedIntent}, 置信度 ${(i.confidence * 100).toFixed(0)}%`);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnProps<ScheduleIntent>[] = [
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
      <Typography.Title heading={4}>调度意图识别</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={form}>
          <Form.TextArea
            field="intentText"
            label="输入一句话"
            rows={3}
            initValue=""
            placeholder="例如：每周一早上发邮件给我本周团队数据..."
          />
          <Button
            theme="solid"
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
