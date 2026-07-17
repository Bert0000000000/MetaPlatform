import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
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
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { listConcepts } from '@/api/concepts';
import {
  createRelationType,
  deleteRelationType,
  listRelationTypes,
  listRelationInstances,
  updateRelationType,
} from '@/api/relations';
import RelationTypeForm from '@/components/RelationTypeForm';
import RelationGraphView from '@/components/RelationGraphView';
import type { RelationInstance, RelationType } from '@/api/relations';
import type { Concept } from '@/types';

export default function RelationTypePage() {
  const [relations, setRelations] = useState<RelationType[]>([]);
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [instances, setInstances] = useState<RelationInstance[]>([]);
  const [editing, setEditing] = useState<RelationType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, c, inst] = await Promise.all([
        listRelationTypes(),
        listConcepts(),
        listRelationInstances(),
      ]);
      setRelations(r.items);
      setConcepts(c.items);
      setInstances(inst);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (values: Omit<RelationType, 'relationTypeId' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await updateRelationType(editing.relationTypeId, values);
        message.success('已更新');
      } else {
        await createRelationType(values);
        message.success('已创建');
      }
      setFormOpen(false);
      setEditing(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<RelationType> = [
    {
      title: '关系',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <BranchesOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '源概念 → 目标概念',
      key: 'endpoints',
      render: (_, r) => (
        <Space>
          <Tag>{concepts.find((c) => c.conceptId === r.sourceConcept)?.name || r.sourceConcept}</Tag>
          →
          <Tag color="blue">{concepts.find((c) => c.conceptId === r.targetConcept)?.name || r.targetConcept}</Tag>
        </Space>
      ),
    },
    { title: '基数', dataIndex: 'cardinality', render: (v) => <Tag color="purple">{v}</Tag> },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(r);
              setFormOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deleteRelationType(r.relationTypeId);
              message.success('已删除');
              load();
            }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          关系类型管理
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          创建关系
        </Button>
      </div>

      <Tabs
        items={[
          {
            key: 'list',
            label: '关系类型',
            children: (
              <Card>
                {relations.length === 0 && !loading ? (
                  <Empty description="还没有关系类型" />
                ) : (
                  <Table
                    rowKey="relationTypeId"
                    dataSource={relations}
                    columns={columns}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'graph',
            label: '关系图',
            children: <Card><RelationGraphView relations={relations} /></Card>,
          },
          {
            key: 'instances',
            label: `关系实例 (${instances.length})`,
            children: (
              <Card>
                {instances.length === 0 ? (
                  <Empty description="还没有关系实例" />
                ) : (
                  <Table
                    rowKey="relationInstanceId"
                    dataSource={instances}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      { title: '实例', dataIndex: 'relationInstanceId' },
                      { title: '源', dataIndex: 'sourceEntityId' },
                      { title: '目标', dataIndex: 'targetEntityId' },
                      {
                        title: '创建时间',
                        dataIndex: 'createdAt',
                        render: (v) => (v ? new Date(v).toLocaleString() : '-'),
                      },
                    ]}
                  />
                )}
              </Card>
            ),
          },
        ]}
      />

      <RelationTypeForm
        open={formOpen}
        initial={editing}
        concepts={concepts.map((c) => ({ conceptId: c.conceptId, name: c.name }))}
        onOk={handleSubmit}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        confirmLoading={submitting}
      />
    </div>
  );
}
