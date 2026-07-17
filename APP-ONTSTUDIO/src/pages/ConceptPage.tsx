import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Button,
  Table,
  Space,
  Input,
  Popconfirm,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import ConceptTree from '@/components/ConceptTree';
import ConceptForm from '@/components/ConceptForm';
import {
  listConcepts,
  createConcept,
  updateConcept,
  deleteConcept,
  getConceptHierarchy,
} from '@/api/concepts';
import type { Concept, ConceptCreateRequest, ConceptHierarchyNode } from '@/types';

export default function ConceptPage() {
  const navigate = useNavigate();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedConceptId, setSelectedConceptId] = useState<string | undefined>();
  const [conceptTree, setConceptTree] = useState<ConceptHierarchyNode[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Concept | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, treeRes] = await Promise.all([listConcepts(), getConceptHierarchy(undefined, 5)]);
      setConcepts(listRes.items || []);
      setConceptTree(treeRes.nodes || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: ConceptCreateRequest) => {
    setSubmitting(true);
    try {
      await createConcept(values);
      message.success('概念创建成功');
      setFormOpen(false);
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: ConceptCreateRequest) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateConcept(editing.conceptId, values);
      message.success('概念更新成功');
      setEditing(null);
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (concept: Concept) => {
    await deleteConcept(concept.conceptId);
    message.success('概念删除成功');
    loadData();
  };

  const filteredConcepts = concepts.filter(
    (c) =>
      c.name.toLowerCase().includes(keyword.toLowerCase()) ||
      c.code.toLowerCase().includes(keyword.toLowerCase())
  );

  const selectedSubtreeIds = (id: string): string[] => {
    const concept = concepts.find((c) => c.conceptId === id);
    if (!concept) return [id];
    const children = concepts.filter((c) => c.parentConceptId === id);
    return [id, ...children.flatMap((c) => selectedSubtreeIds(c.conceptId))];
  };

  const displayConcepts = selectedConceptId
    ? filteredConcepts.filter((c) => selectedSubtreeIds(selectedConceptId).includes(c.conceptId))
    : filteredConcepts;

  const columns = [
    {
      title: '概念名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Concept) => (
        <Typography.Link onClick={() => navigate(`/concepts/${record.conceptId}`)}>
          {text}
        </Typography.Link>
      ),
    },
    { title: '概念编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '属性数量',
      dataIndex: 'attributeCount',
      key: 'attributeCount',
      render: (v?: number) => v ?? 0,
    },
    {
      title: '实例数量',
      dataIndex: 'entityCount',
      key: 'entityCount',
      render: (v?: number) => v ?? 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Concept) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(record);
              setFormOpen(true);
            }}
          />
          <Popconfirm
            title="确认删除"
            description={`确定删除概念「${record.name}」吗？`}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={5}>
        <Card title="概念树" size="small">
          <ConceptTree onSelect={setSelectedConceptId} selectedKey={selectedConceptId} />
        </Card>
      </Col>
      <Col span={19}>
        <Card
          title="概念管理"
          size="small"
          extra={
            <Space>
              <Input.Search
                placeholder="搜索名称/编码"
                allowClear
                onSearch={setKeyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 240 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                创建概念
              </Button>
            </Space>
          }
        >
          <Table
            rowKey="conceptId"
            columns={columns}
            dataSource={displayConcepts}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Col>

      <ConceptForm
        open={formOpen}
        title={editing ? '编辑概念' : '创建概念'}
        initial={editing}
        conceptTree={conceptTree}
        onOk={editing ? handleUpdate : handleCreate}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        confirmLoading={submitting}
      />
    </Row>
  );
}
