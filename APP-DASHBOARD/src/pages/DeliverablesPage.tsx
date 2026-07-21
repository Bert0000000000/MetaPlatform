import { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Space,
  Select,
  Button,
  Modal,
  Typography,
  Descriptions,
  message,
  Popconfirm,
} from 'antd';
import {
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { listDeliverables, downloadDeliverable, deleteDeliverable } from '@/api/deliverables';
import type { Deliverable, DeliverableType, DeliverableFormat } from '@/types';
// V12-08: 使用 @mate/shared 统一的 SectionCard + SearchInput（带防抖）。
import { SectionCard, SearchInput } from '@mate/shared';

const TYPE_LABEL: Record<DeliverableType, string> = {
  report: '分析报告',
  task_output: '任务产出',
  schedule_summary: '调度总结',
  analysis: '分析结果',
};

const FORMAT_ICON: Record<DeliverableFormat, React.ReactNode> = {
  pdf: <FilePdfOutlined style={{ color: '#f5222d' }} />,
  json: <CodeOutlined style={{ color: '#1677ff' }} />,
  markdown: <FileTextOutlined style={{ color: '#722ed1' }} />,
};

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  ready: { color: 'green', label: '可下载' },
  generating: { color: 'blue', label: '生成中' },
  failed: { color: 'red', label: '失败' },
};

export default function DeliverablesPage() {
  const [list, setList] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState<DeliverableType | undefined>();
  const [detail, setDetail] = useState<Deliverable | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listDeliverables({ keyword, type });
      setList(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, type]);

  const handleDownload = async (item: Deliverable, format: string) => {
    const result = await downloadDeliverable(item.id, format);
    message.success(result.message);
  };

  const handleDelete = async (id: string) => {
    await deleteDeliverable(id);
    message.success('已删除');
    load();
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Deliverable) => (
        <Space>
          {FORMAT_ICON[record.format]}
          <Typography.Link onClick={() => { setDetail(record); setDetailOpen(true); }}>{text}</Typography.Link>
        </Space>
      ),
    },
    { title: '来源', dataIndex: 'source', key: 'source' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: DeliverableType) => <Tag>{TYPE_LABEL[t]}</Tag>,
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
      render: (f: DeliverableFormat) => <Tag>{f.toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Deliverable) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setDetail(record); setDetailOpen(true); }}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            disabled={record.status !== 'ready'}
            onClick={() => handleDownload(record, record.format)}
          >
            下载
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <SectionCard
      title="历史交付物"
      extra={
        <Space>
          {/* V12-08: SearchInput 内置 300ms 防抖，避免每次按键触发后端查询。 */}
          <SearchInput
            placeholder="全文搜索"
            onSearch={setKeyword}
            width={240}
          />
          <Select
            placeholder="类型筛选"
            allowClear
            style={{ width: 140 }}
            value={type}
            onChange={setType}
          >
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
        </Space>
      }
      bodyPadding={0}
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />

      <Modal
        title="交付物详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          detail && (
            <Space>
              <Button onClick={() => setDetailOpen(false)}>关闭</Button>
              <Button icon={<DownloadOutlined />} onClick={() => handleDownload(detail, 'pdf')}>
                下载 PDF
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => handleDownload(detail, 'json')}>
                下载 JSON
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => handleDownload(detail, 'markdown')}>
                下载 Markdown
              </Button>
            </Space>
          )
        }
        width={640}
      >
        {detail && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="标题">{detail.title}</Descriptions.Item>
            <Descriptions.Item label="描述">{detail.description}</Descriptions.Item>
            <Descriptions.Item label="来源">{detail.source}</Descriptions.Item>
            <Descriptions.Item label="类型">{TYPE_LABEL[detail.type]}</Descriptions.Item>
            <Descriptions.Item label="格式">{detail.format.toUpperCase()}</Descriptions.Item>
            <Descriptions.Item label="大小">{(detail.size / 1024).toFixed(1)} KB</Descriptions.Item>
            <Descriptions.Item label="创建人">{detail.createdBy}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(detail.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </SectionCard>
  );
}
