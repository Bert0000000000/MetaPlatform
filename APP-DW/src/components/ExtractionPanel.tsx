import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Tabs,
  Statistic,
  Row,
  Col,
  Modal,
  Alert,
  message,
  Progress,
  Tooltip,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  TeamOutlined,
  CodeOutlined,
  SafetyOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import {
  extractFromDocument,
  getExtractionsByEmployee,
  reviewExtractionItem,
  batchReview,
  commitToOntology,
} from '@/api/extraction';
import type { ExtractionItem, ExtractionType, ExtractionStatus } from '@/types';

interface ExtractionPanelProps {
  employeeId: string;
  documentId?: string;
}

const TYPE_CONFIG: Record<ExtractionType, { label: string; color: string; icon: React.ReactNode }> = {
  concept: { label: '概念', color: 'blue', icon: <ApartmentOutlined /> },
  entity: { label: '实体', color: 'green', icon: <TeamOutlined /> },
  rule: { label: '规则', color: 'orange', icon: <SafetyOutlined /> },
  action: { label: 'Action', color: 'purple', icon: <ThunderboltOutlined /> },
};

const STATUS_CONFIG: Record<ExtractionStatus, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'default' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已拒绝', color: 'error' },
  committed: { label: '已提交', color: 'blue' },
};

export default function ExtractionPanel({ employeeId, documentId }: ExtractionPanelProps) {
  const [items, setItems] = useState<ExtractionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<ExtractionType>('concept');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [committing, setCommitting] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      let results: ExtractionItem[];
      if (documentId) {
        const result = await extractFromDocument(documentId, employeeId);
        results = result.items;
      } else {
        results = await getExtractionsByEmployee(employeeId);
      }
      setItems(results);
    } finally {
      setLoading(false);
    }
  }, [employeeId, documentId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleReview = useCallback(
    async (itemId: string, status: 'approved' | 'rejected') => {
      try {
        await reviewExtractionItem(itemId, status);
        message.success(status === 'approved' ? '已通过' : '已拒绝');
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, status, reviewedAt: new Date().toISOString() }
              : i,
          ),
        );
      } catch (error) {
        message.error(error instanceof Error ? error.message : '操作失败');
      }
    },
    [],
  );

  const handleBatchReview = useCallback(
    async (status: 'approved' | 'rejected') => {
      if (selectedIds.length === 0) {
        message.warning('请先选择项目');
        return;
      }
      try {
        await batchReview(selectedIds, status);
        message.success(`已批量${status === 'approved' ? '通过' : '拒绝'} ${selectedIds.length} 项`);
        setItems((prev) =>
          prev.map((i) =>
            selectedIds.includes(i.id)
              ? { ...i, status, reviewedAt: new Date().toISOString() }
              : i,
          ),
        );
        setSelectedIds([]);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '批量操作失败');
      }
    },
    [selectedIds],
  );

  const handleCommit = useCallback(async () => {
    const approvedIds = items
      .filter((i) => i.status === 'approved' && i.type === activeTab)
      .map((i) => i.id);
    if (approvedIds.length === 0) {
      message.warning('没有已通过的项目可提交');
      return;
    }
    setCommitting(true);
    try {
      const results = await commitToOntology(approvedIds);
      const successCount = results.filter((r) => r.commitResult?.success).length;
      const failCount = results.length - successCount;
      message.success(`提交完成：${successCount} 项成功${failCount > 0 ? `，${failCount} 项失败` : ''}`);
      setItems((prev) =>
        prev.map((i) => {
          const result = results.find((r) => r.id === i.id);
          return result ? { ...i, ...result } : i;
        }),
      );
      setCommitModalOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '提交失败');
    } finally {
      setCommitting(false);
    }
  }, [items, activeTab]);

  const handleExtract = useCallback(async () => {
    if (!documentId) return;
    setExtracting(true);
    try {
      const result = await extractFromDocument(documentId, employeeId);
      setItems(result.items);
      message.success(`AI 抽取完成：${result.items.length} 项`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '抽取失败');
    } finally {
      setExtracting(false);
    }
  }, [documentId, employeeId]);

  const stats = {
    concepts: items.filter((i) => i.type === 'concept').length,
    entities: items.filter((i) => i.type === 'entity').length,
    rules: items.filter((i) => i.type === 'rule').length,
    actions: items.filter((i) => i.type === 'action').length,
    approved: items.filter((i) => i.status === 'approved').length,
    committed: items.filter((i) => i.status === 'committed').length,
  };

  const renderItemsTable = (type: ExtractionType) => {
    const filtered = items.filter((i) => i.type === type);
    return (
      <Table
        size="small"
        loading={loading}
        dataSource={filtered}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
          getCheckboxProps: (record) => ({
            disabled: record.status === 'committed',
          }),
        }}
        columns={[
          {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
          },
          {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
          },
          {
            title: '置信度',
            dataIndex: 'confidence',
            key: 'confidence',
            width: 120,
            sorter: (a, b) => b.confidence - a.confidence,
            render: (val: number) => (
              <Tooltip title={`${val}%`}>
                <Progress
                  percent={val}
                  size="small"
                  strokeColor={val >= 90 ? '#52c41a' : val >= 70 ? '#faad14' : '#f5222d'}
                />
              </Tooltip>
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: ExtractionStatus) => (
              <Tag color={STATUS_CONFIG[status].color}>{STATUS_CONFIG[status].label}</Tag>
            ),
          },
          {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_: unknown, record: ExtractionItem) => (
              <Space size="small">
                {record.status === 'pending' && (
                  <>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => handleReview(record.id, 'approved')}
                    >
                      通过
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => handleReview(record.id, 'rejected')}
                    >
                      拒绝
                    </Button>
                  </>
                )}
                {record.status === 'approved' && (
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => handleReview(record.id, 'rejected')}
                  >
                    撤销
                  </Button>
                )}
                {record.status === 'rejected' && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => handleReview(record.id, 'approved')}
                  >
                    恢复
                  </Button>
                )}
                {record.status === 'committed' && record.commitResult && (
                  <Tag color={record.commitResult.success ? 'green' : 'red'}>
                    {record.commitResult.success ? '✓ 已写入' : '✗ 失败'}
                  </Tag>
                )}
              </Space>
            ),
          },
        ]}
        pagination={{ pageSize: 5 }}
      />
    );
  };

  const approvedItems = items.filter((i) => i.status === 'approved');

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="概念" value={stats.concepts} prefix={<ApartmentOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="实体" value={stats.entities} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="规则" value={stats.rules} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Action" value={stats.actions} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="已通过"
              value={stats.approved}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="已提交"
              value={stats.committed}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        {documentId && (
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={extracting}
            onClick={handleExtract}
          >
            重新 AI 抽取
          </Button>
        )}
        <Button
          icon={<CheckOutlined />}
          onClick={() => handleBatchReview('approved')}
          disabled={selectedIds.length === 0}
        >
          批量通过
        </Button>
        <Button
          danger
          icon={<CloseOutlined />}
          onClick={() => handleBatchReview('rejected')}
          disabled={selectedIds.length === 0}
        >
          批量拒绝
        </Button>
        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          onClick={() => setCommitModalOpen(true)}
          disabled={approvedItems.length === 0}
        >
          提交到 Ontology ({approvedItems.length})
        </Button>
      </Space>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as ExtractionType);
          setSelectedIds([]);
        }}
        items={(Object.keys(TYPE_CONFIG) as ExtractionType[]).map((type) => ({
          key: type,
          label: (
            <Space size={4}>
              {TYPE_CONFIG[type].icon}
              <span>{TYPE_CONFIG[type].label}</span>
              <Tag>{items.filter((i) => i.type === type).length}</Tag>
            </Space>
          ),
          children: renderItemsTable(type),
        }))}
      />

      <Modal
        title="确认提交到 Ontology"
        open={commitModalOpen}
        onOk={handleCommit}
        onCancel={() => setCommitModalOpen(false)}
        confirmLoading={committing}
        okText="确认提交"
        cancelText="取消"
      >
        <Alert
          message={`即将提交 ${approvedItems.filter((i) => i.type === activeTab).length} 项已通过的内容到 Ontology 引擎`}
          description="提交后内容将写入本体引擎，成为平台的统一数据真相源。此操作不可撤销。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div>
          {approvedItems
            .filter((i) => i.type === activeTab)
            .map((item) => (
              <div key={item.id} style={{ marginBottom: 4 }}>
                <Tag color={TYPE_CONFIG[item.type].color}>{TYPE_CONFIG[item.type].label}</Tag>
                <Typography.Text>{item.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  置信度 {item.confidence}%
                </Typography.Text>
              </div>
            ))}
        </div>
      </Modal>
    </div>
  );
}
