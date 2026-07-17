import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Descriptions,
  Button,
  Space,
  Tag,
  Table,
  Popconfirm,
  message,
  Spin,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getConcept, updateConcept } from '@/api/concepts';
import {
  listAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
} from '@/api/attributes';
import AttributeForm from '@/components/AttributeForm';
import type { Concept, ConceptCreateRequest, Attribute, AttributeCreateRequest } from '@/types';

export default function ConceptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [concept, setConcept] = useState<Concept | null>(null);
  const [loading, setLoading] = useState(false);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [attrLoading, setAttrLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<Attribute | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadConcept = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getConcept(id);
      setConcept(data);
    } finally {
      setLoading(false);
    }
  };

  const loadAttributes = async () => {
    if (!id) return;
    setAttrLoading(true);
    try {
      const res = await listAttributes({ conceptId: id });
      setAttributes(res.items || []);
    } finally {
      setAttrLoading(false);
    }
  };

  useEffect(() => {
    loadConcept();
    loadAttributes();
  }, [id]);

  const handleCreateAttr = async (values: AttributeCreateRequest) => {
    if (!id || !concept) return;
    setSubmitting(true);
    try {
      const attr = await createAttribute(values);
      const currentIds = concept.attributeIds || [];
      await updateConcept(id, {
        name: concept.name,
        code: concept.code,
        description: concept.description,
        parentConceptId: concept.parentConceptId,
        icon: concept.icon,
        attributeIds: [...currentIds, attr.attributeId],
      } as ConceptCreateRequest);
      message.success('属性添加成功');
      setFormOpen(false);
      loadConcept();
      loadAttributes();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAttr = async (values: AttributeCreateRequest) => {
    if (!editingAttr) return;
    setSubmitting(true);
    try {
      await updateAttribute(editingAttr.attributeId, values);
      message.success('属性更新成功');
      setEditingAttr(null);
      loadAttributes();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttr = async (attr: Attribute) => {
    if (!id || !concept) return;
    const currentIds = concept.attributeIds || [];
    await updateConcept(id, {
      name: concept.name,
      code: concept.code,
      description: concept.description,
      parentConceptId: concept.parentConceptId,
      icon: concept.icon,
      attributeIds: currentIds.filter((attrId) => attrId !== attr.attributeId),
    } as ConceptCreateRequest);
    await deleteAttribute(attr.attributeId);
    message.success('属性删除成功');
    loadConcept();
    loadAttributes();
  };

  const attrColumns = [
    { title: '属性编码', dataIndex: 'code', key: 'code' },
    { title: '属性名称', dataIndex: 'name', key: 'name' },
    { title: '数据类型', dataIndex: 'dataType', key: 'dataType' },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      render: (v?: boolean) => (v ? '是' : '否'),
    },
    {
      title: '唯一',
      dataIndex: 'unique',
      key: 'unique',
      render: (v?: boolean) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Attribute) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingAttr(record);
              setFormOpen(true);
            }}
          />
          <Popconfirm
            title="确认删除"
            description={`确定删除属性「${record.name}」吗？`}
            onConfirm={() => handleDeleteAttr(record)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading || !concept) {
    return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  }

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/concepts')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>
      <Card
        title={
          <Space>
            <span>{concept.name}</span>
            <Tag>{concept.code}</Tag>
            <Tag>{concept.status}</Tag>
          </Space>
        }
      >
        <Tabs
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="概念编码">{concept.code}</Descriptions.Item>
                  <Descriptions.Item label="概念名称">{concept.name}</Descriptions.Item>
                  <Descriptions.Item label="父概念">{concept.parentConceptId || '-'}</Descriptions.Item>
                  <Descriptions.Item label="状态">{concept.status}</Descriptions.Item>
                  <Descriptions.Item label="描述" span={2}>
                    {concept.description || '-'}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'attributes',
              label: '属性列表',
              children: (
                <Card
                  size="small"
                  extra={
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingAttr(null);
                        setFormOpen(true);
                      }}
                    >
                      添加属性
                    </Button>
                  }
                >
                  <Table
                    rowKey="attributeId"
                    columns={attrColumns}
                    dataSource={attributes}
                    loading={attrLoading}
                    pagination={false}
                  />
                </Card>
              ),
            },
          ]}
        />
      </Card>

      <AttributeForm
        open={formOpen}
        title={editingAttr ? '编辑属性' : '添加属性'}
        initial={editingAttr}
        onOk={editingAttr ? handleUpdateAttr : handleCreateAttr}
        onCancel={() => {
          setFormOpen(false);
          setEditingAttr(null);
        }}
        confirmLoading={submitting}
      />
    </div>
  );
}
