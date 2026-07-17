import { useEffect, useState } from 'react';
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
import EntityForm from '@/components/EntityForm';
import { listEntities, createEntity, updateEntity, deleteEntity } from '@/api/entities';
import { getConceptHierarchy } from '@/api/search';
import type { Entity, EntityCreateRequest, ConceptHierarchyNode } from '@/types';

export default function EntityPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedConceptId, setSelectedConceptId] = useState<string | undefined>();
  const [conceptTree, setConceptTree] = useState<ConceptHierarchyNode[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, treeRes] = await Promise.all([
        listEntities({ keyword, conceptId: selectedConceptId, includeAttributes: false }),
        getConceptHierarchy(undefined, 5),
      ]);
      setEntities(listRes.items || []);
      setConceptTree(treeRes.nodes || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [keyword, selectedConceptId]);

  const handleCreate = async (values: EntityCreateRequest) => {
    setSubmitting(true);
    try {
      await createEntity(values);
      message.success('实体创建成功');
      setFormOpen(false);
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: EntityCreateRequest) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateEntity(editing.entityId, values);
      message.success('实体更新成功');
      setEditing(null);
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entity: Entity) => {
    await deleteEntity(entity.entityId);
    message.success('实体删除成功');
    loadData();
  };

  const columns = [
    {
      title: '实体名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Entity) => (
        <Typography.Link>{text}</Typography.Link>
      ),
    },
    { title: '实体编码', dataIndex: 'code', key: 'code' },
    { title: '所属概念', dataIndex: 'conceptName', key: 'conceptName' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v?: string) => (v ? <Tag>{v}</Tag> : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Entity) => (
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
            description={`确定删除实体「${record.name}」吗？`}
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
          title="实体管理"
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
                创建实体
              </Button>
            </Space>
          }
        >
          <Table
            rowKey="entityId"
            columns={columns}
            dataSource={entities}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Col>

      <EntityForm
        open={formOpen}
        title={editing ? '编辑实体' : '创建实体'}
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
