import { useEffect, useMemo, useState } from 'react';
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
  Input,
  Select,
  Empty,
  Timeline,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { getConcept, updateConcept } from '@/api/concepts';
import {
  listAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
} from '@/api/attributes';
import { listEntities } from '@/api/entities';
import {
  listRelationTypes,
  listRelationInstances,
} from '@/api/relations';
import type { RelationInstance, RelationType } from '@/api/relations';
import { listVersions } from '@/api/versions';
import type { OntologyVersion } from '@/api/versions';
import { getLineage } from '@/api/lineage';
import { listRules } from '@/api/rules';
import type { OntologyRule } from '@/api/rules';
import { listDecisionTables } from '@/api/decision-tables';
import type { DecisionTable } from '@/types';
import AttributeForm from '@/components/AttributeForm';
import LineageSubgraphX6 from '@/components/LineageSubgraphX6';
import type {
  Concept,
  ConceptCreateRequest,
  Attribute,
  AttributeCreateRequest,
  Entity,
  DataLineage,
} from '@/types';

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
                    pagination={false} scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'entities',
              label: '实体实例',
              children: <EntitiesTab conceptId={concept.conceptId} attributes={attributes} />,
            },
            {
              key: 'relations',
              label: '关系实例',
              children: <RelationsTab conceptId={concept.conceptId} />,
            },
            {
              key: 'versions',
              label: '版本时间线',
              children: <VersionsTab conceptId={concept.conceptId} conceptName={concept.name} />,
            },
            {
              key: 'lineage',
              label: '血缘子图',
              children: <LineageTab conceptId={concept.conceptId} conceptName={concept.name} />,
            },
            {
              key: 'rules',
              label: '关联规则',
              children: <RulesTab conceptId={concept.conceptId} />,
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

// ============ 实体实例 Tab ============

function EntitiesTab({ conceptId, attributes }: { conceptId: string; attributes: Attribute[] }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listEntities({
        conceptId,
        keyword: keyword || undefined,
        includeAttributes: true,
      });
      const items = res.items || [];
      setTotal(items.length);
      setEntities(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, keyword]);

  // 动态属性列：基于概念的属性定义生成
  const dynamicAttrColumns = useMemo<ColumnsType<Entity>>(() => {
    return attributes.map((attr) => ({
      title: attr.name,
      key: `attr-${attr.attributeId}`,
      width: 140,
      ellipsis: true,
      render: (_: unknown, record: Entity) => {
        const v = record.attributes?.[attr.code]?.value;
        if (v === undefined || v === null || v === '') return '-';
        const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return text.length > 30 ? `${text.slice(0, 30)}…` : text;
      },
    }));
  }, [attributes]);

  const baseColumns: ColumnsType<Entity> = [
    { title: '实例编码', dataIndex: 'code', key: 'code', width: 140, ellipsis: true },
    {
      title: '实例名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v?: string) => v ? <Tag>{v}</Tag> : '-' },
    ...dynamicAttrColumns,
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v?: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
  ];

  // 前端分页（API 当前返回全量，前端切片展示）
  const pagedEntities = useMemo(() => {
    const from = (page - 1) * pageSize;
    return entities.slice(from, from + pageSize);
  }, [entities, page, pageSize]);

  return (
    <Card
      size="small"
      extra={
        <Input.Search
          placeholder="搜索实例名称/编码"
          allowClear
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          onSearch={setKeyword}
          style={{ width: 260 }}
          prefix={<SearchOutlined />}
        />
      }
    >
      <Table
        rowKey="entityId"
        columns={baseColumns}
        dataSource={pagedEntities}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </Card>
  );
}

// ============ 关系实例 Tab ============

function RelationsTab({ conceptId }: { conceptId: string }) {
  const [instances, setInstances] = useState<RelationInstance[]>([]);
  const [types, setTypes] = useState<RelationType[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTypeId, setFilterTypeId] = useState<string | undefined>(undefined);

  const load = async () => {
    setLoading(true);
    try {
      // 获取与该概念相关的所有关系类型（作为源或目标）
      const [asSource, asTarget] = await Promise.all([
        listRelationTypes({ sourceConceptId: conceptId }),
        listRelationTypes({ targetConceptId: conceptId }),
      ]);
      const merged = new Map<string, RelationType>();
      [...asSource.items, ...asTarget.items].forEach((t) => merged.set(t.relationTypeId, t));
      const relatedTypes = Array.from(merged.values());
      setTypes(relatedTypes);

      // 对每个相关关系类型，拉取其关系实例
      const instanceLists = await Promise.all(
        relatedTypes.map((t) =>
          listRelationInstances({ relationTypeId: t.relationTypeId }).then((r) => r.items),
        ),
      );
      const all = instanceLists.flat();
      setInstances(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  const filteredInstances = useMemo(() => {
    if (!filterTypeId) return instances;
    return instances.filter((i) => i.relationTypeId === filterTypeId);
  }, [instances, filterTypeId]);

  const typeMap = useMemo(() => {
    const m = new Map<string, RelationType>();
    types.forEach((t) => m.set(t.relationTypeId, t));
    return m;
  }, [types]);

  const columns: ColumnsType<RelationInstance> = [
    {
      title: '关系类型',
      dataIndex: 'relationTypeId',
      key: 'relationType',
      width: 160,
      render: (v: string) => {
        const t = typeMap.get(v);
        return t ? <Tag color="blue">{t.name}</Tag> : <Tag>{v}</Tag>;
      },
    },
    {
      title: '源实体',
      key: 'source',
      width: 200,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{r.sourceEntityName || r.sourceEntityId}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {r.sourceEntityId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '目标实体',
      key: 'target',
      width: 200,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{r.targetEntityName || r.targetEntityId}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {r.targetEntityId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v?: string) => (v ? <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag> : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v?: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
  ];

  return (
    <Card
      size="small"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="按关系类型筛选"
            style={{ width: 220 }}
            value={filterTypeId}
            onChange={setFilterTypeId}
            options={types.map((t) => ({ label: `${t.name} (${t.code})`, value: t.relationTypeId }))}
          />
        </Space>
      }
    >
      <Table
        rowKey="relationInstanceId"
        columns={columns}
        dataSource={filteredInstances}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 'max-content' }} />
    </Card>
  );
}

// ============ 版本时间线 Tab ============

function VersionsTab({ conceptId, conceptName }: { conceptId: string; conceptName: string }) {
  const [versions, setVersions] = useState<OntologyVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listVersions();
      // 兼容后端返回 PageResponse 或数组两种形态
      const list = Array.isArray(res) ? res : (res.items ?? []);
      setVersions(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  // 标注该概念是否存在于版本快照中（粗略判断：快照里能否找到 conceptId）
  const annotated = useMemo(() => {
    return versions.map((v) => {
      let inSnapshot = false;
      try {
        const snapshot = typeof v.snapshot === 'string' ? JSON.parse(v.snapshot) : v.snapshot;
        const text = JSON.stringify(snapshot ?? {});
        inSnapshot = text.includes(conceptId) || text.includes(conceptName);
      } catch {
        inSnapshot = false;
      }
      return { ...v, inSnapshot };
    });
  }, [versions, conceptId, conceptName]);

  return (
    <Card size="small" loading={loading}>
      {annotated.length === 0 && !loading ? (
        <Empty description="暂无版本记录" />
      ) : (
        <Timeline
          items={annotated.map((v) => ({
            color:
              v.status === 'PUBLISHED' ? 'green' : v.status === 'ARCHIVED' ? 'gray' : 'blue',
            children: (
              <div
                onClick={() => setSelectedId(v.versionId)}
                style={{
                  cursor: 'pointer',
                  background: selectedId === v.versionId ? '#e6f4ff' : 'transparent',
                  padding: 8,
                  borderRadius: 4,
                }}
              >
                <Space>
                  <Typography.Text strong>v{v.code}</Typography.Text>
                  <Tag color={v.status === 'PUBLISHED' ? 'green' : v.status === 'ARCHIVED' ? 'orange' : 'default'}>
                    {v.status}
                  </Tag>
                  {v.inSnapshot && <Tag color="blue">含此概念</Tag>}
                </Space>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {v.description || '无说明'} - {new Date(v.createdAt).toLocaleString()}
                  </Typography.Text>
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );
}

// ============ 血缘子图 Tab ============

function LineageTab({ conceptId, conceptName }: { conceptId: string; conceptName: string }) {
  const [lineage, setLineage] = useState<DataLineage | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // 优先按 conceptId 作为 scope 检索；若返回为空图，则按 conceptName 兜底
      let data = await getLineage(conceptId);
      if (!data.nodes || data.nodes.length === 0) {
        data = await getLineage(conceptName);
      }
      setLineage(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, conceptName]);

  return (
    <Card size="small" loading={loading}>
      {lineage && lineage.nodes.length > 0 ? (
        <LineageSubgraphX6 data={lineage} height={520} />
      ) : (
        <Empty description={`未找到「${conceptName}」相关的血缘数据`} />
      )}
    </Card>
  );
}

// ============ 关联规则 Tab ============

function RulesTab({ conceptId }: { conceptId: string }) {
  const [rules, setRules] = useState<OntologyRule[]>([]);
  const [decisionTables, setDecisionTables] = useState<DecisionTable[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ruleRes, tableRes] = await Promise.all([
        listRules(),
        listDecisionTables(conceptId),
      ]);
      const allRules = ruleRes.items ?? [];
      // OntologyRule 显式带 conceptId 字段，前端按 concept 过滤
      setRules(allRules.filter((r) => r.conceptId === conceptId));
      setDecisionTables(tableRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  const ruleColumns: ColumnsType<OntologyRule> = [
    {
      title: '规则',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{r.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.code}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '触发', dataIndex: 'trigger', key: 'trigger', width: 90, render: (v) => <Tag color="blue">{v}</Tag> },
    {
      title: '条件/动作',
      key: 'count',
      width: 140,
      render: (_, r) => (
        <Space>
          <Tag color="purple">{r.conditions?.length ?? 0} 条件</Tag>
          <Tag color="cyan">{r.actions?.length ?? 0} 动作</Tag>
        </Space>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v?: boolean) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
  ];

  const tableColumns: ColumnsType<DecisionTable> = [
    {
      title: '决策表',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{r.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '命中策略',
      dataIndex: 'hitPolicy',
      key: 'hitPolicy',
      width: 100,
      render: (v) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: '列/行',
      key: 'size',
      width: 120,
      render: (_, r) => (
        <Space>
          <Tag color="blue">{r.columns?.length ?? 0} 列</Tag>
          <Tag color="orange">{r.rows?.length ?? 0} 行</Tag>
        </Space>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v?: boolean) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
  ];

  return (
    <Tabs
      items={[
        {
          key: 'rules',
          label: `规则 (${rules.length})`,
          children: (
            <Card size="small" loading={loading}>
              {rules.length === 0 && !loading ? (
                <Empty description="该概念暂无关联规则" />
              ) : (
                <Table
                  rowKey="ruleId"
                  columns={ruleColumns}
                  dataSource={rules}
                  pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
              )}
            </Card>
          ),
        },
        {
          key: 'decision-tables',
          label: `决策表 (${decisionTables.length})`,
          children: (
            <Card size="small" loading={loading}>
              {decisionTables.length === 0 && !loading ? (
                <Empty description="该概念暂无关联决策表" />
              ) : (
                <Table
                  rowKey="id"
                  columns={tableColumns}
                  dataSource={decisionTables}
                  pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
              )}
            </Card>
          ),
        },
      ]}
    />
  );
}
