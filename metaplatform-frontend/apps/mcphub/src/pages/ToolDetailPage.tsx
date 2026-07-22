import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  EditOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  compareToolVersions,
  getTool,
  listToolVersions,
  rollbackToolVersion,
  setCurrentToolVersion,
} from '@/api/tools';
import type { McpTool, McpToolVersion, McpToolVersionCompareResult } from '@/types';

export default function ToolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<McpTool | null>(null);
  const [versions, setVersions] = useState<McpToolVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareResult, setCompareResult] = useState<McpToolVersionCompareResult | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [t, vs] = await Promise.all([getTool(id), listToolVersions(id)]);
      setTool(t);
      setVersions(vs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleRollback = async (versionId: string) => {
    if (!id) return;
    await rollbackToolVersion(id, versionId);
    message.success('已回滚到该版本');
    load();
  };

  const handleSetCurrent = async (versionId: string) => {
    if (!id) return;
    await setCurrentToolVersion(id, versionId);
    message.success('已设为当前版本');
    load();
  };

  const handleCompare = async (leftId: string, rightId: string) => {
    if (!id) return;
    const result = await compareToolVersions(id, leftId, rightId);
    setCompareResult(result);
    setCompareOpen(true);
  };

  const versionColumns: ColumnsType<McpToolVersion> = [
    {
      title: '版本',
      dataIndex: 'version',
      render: (v, record) => (
        <Space>
          <Typography.Text strong>v{v}</Typography.Text>
          {record.isCurrent && <Tag color="green">当前</Tag>}
        </Space>
      ),
    },
    {
      title: '参数数',
      key: 'params',
      render: (_, record) => `${record.schema.length} 个`,
    },
    {
      title: '变更说明',
      dataIndex: 'changeLog',
      render: (v) => v || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record, index) => (
        <Space>
          <Popconfirm
            title="回滚到此版本？"
            description="当前工具 schema 与描述将被替换为该版本内容。"
            onConfirm={() => handleRollback(record.id)}
          >
            <Button type="link" icon={<RollbackOutlined />}>
              回滚
            </Button>
          </Popconfirm>
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            disabled={record.isCurrent}
            onClick={() => handleSetCurrent(record.id)}
          >
            设为当前
          </Button>
          {index > 0 && (
            <Button
              type="link"
              icon={<SwapOutlined />}
              onClick={() => handleCompare(versions[index - 1]!.id, record.id)}
            >
              与上一版对比
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tools')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {tool?.name ?? '工具详情'}
        </Typography.Title>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate(`/tools/${id}/edit`)}
        >
          编辑
        </Button>
      </Space>

      <Tabs defaultActiveKey="overview">
        <Tabs.TabPane tab="概览" key="overview">
          <Card loading={loading}>
            {tool && (
              <Descriptions bordered column={2}>
                <Descriptions.Item label="编码">{tool.code}</Descriptions.Item>
                <Descriptions.Item label="分类">
                  <Tag color="blue">{tool.category}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="当前版本">
                  <Tag color="purple">v{tool.version}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="启用">{tool.enabled ? '是' : '否'}</Descriptions.Item>
                <Descriptions.Item label="描述" span={2}>
                  {tool.description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="标签" span={2}>
                  <Space>
                    {tool.tags?.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab="版本历史" key="versions">
          <Card>
            <Table
              rowKey="id"
              dataSource={versions}
              columns={versionColumns}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle" scroll={{ x: 'max-content' }} />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      <Modal
        title="版本对比"
        open={compareOpen}
        width={900}
        footer={null}
        onCancel={() => setCompareOpen(false)}
      >
        {compareResult && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Tag color="blue">差异项</Tag>
                {compareResult.differences.map((d) => (
                  <Tag key={d} color="orange">
                    {d}
                  </Tag>
                ))}
              </Space>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card title={`v${compareResult.left.version}`} size="small">
                  <pre style={{ maxHeight: 360, overflow: 'auto' }}>
                    {JSON.stringify(
                      {
                        description: compareResult.left.description,
                        schema: compareResult.left.schema,
                        changeLog: compareResult.left.changeLog,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </Card>
                <Card title={`v${compareResult.right.version}`} size="small">
                  <pre style={{ maxHeight: 360, overflow: 'auto' }}>
                    {JSON.stringify(
                      {
                        description: compareResult.right.description,
                        schema: compareResult.right.schema,
                        changeLog: compareResult.right.changeLog,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </Card>
              </div>
            </Space>
          )}
      </Modal>
    </div>
  );
}
