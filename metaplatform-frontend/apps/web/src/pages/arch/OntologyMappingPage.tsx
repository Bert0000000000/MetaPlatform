import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Select,
  Input,
  Toast,
  Popconfirm,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  LinkOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import {
  listMappingRules,
  createMappingRule,
  updateMappingRule,
  deleteMappingRule,
  syncToOntology,
  syncFromOntology,
  listPendingChanges,
  resolveChange,
  getOntologyMappings,
} from '@/api/arch/ontologyMapping';
import { listCapabilities } from '@/api/arch/capabilities';
import { listApplications } from '@/api/arch/applications';
import { searchOntologyConcepts } from '@/api/arch/ontology';
import OntologyMappingGraph from './components/OntologyMapping';
import type {
  ConceptMappingRule,
  CreateMappingRuleRequest,
  OntologyChangeEvent,
  Capability,
  ArchApplication,
  OntologyConcept,
  OntologyMapping,
  ImpactAnalysisResult,
} from '@/api/arch/types';

const MAPPING_TYPE_TAG: Record<string, { color: TagColor; label: string }> = {
  DIRECT: { color: 'green', label: '直接映射' },
  DERIVED: { color: 'blue', label: '派生映射' },
  ABSTRACT: { color: 'purple', label: '抽象映射' },
};

const ASSET_TYPE_TAG: Record<string, { color: TagColor; label: string }> = {
  CAPABILITY: { color: 'cyan', label: '业务能力' },
  APPLICATION: { color: 'indigo', label: '应用系统' },
};

export default function OntologyMappingPage() {
  const [rules, setRules] = useState<ConceptMappingRule[]>([]);
  const [events, setEvents] = useState<OntologyChangeEvent[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [applications, setApplications] = useState<ArchApplication[]>([]);
  const [concepts, setConcepts] = useState<OntologyConcept[]>([]);
  const [mappings, setMappings] = useState<OntologyMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConceptMappingRule | null>(null);
  const [assetType, setAssetType] = useState<string | undefined>(undefined);
  const [form] = Form.useForm<CreateMappingRuleRequest>();

  const conceptDetailUrl = (conceptId: string) => `/ontology-studio/concepts/${conceptId}`;

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      listMappingRules(),
      listPendingChanges(),
      listCapabilities(),
      listApplications(),
      searchOntologyConcepts(),
    ])
      .then((results) => {
        const [rulesRes, eventsRes, capsRes, appsRes, conceptsRes] = results;
        if (rulesRes.status === 'fulfilled') {
          const v = rulesRes.value;
          setRules(Array.isArray(v) ? v : ((v as { items?: ConceptMappingRule[] }).items ?? []));
        }
        if (eventsRes.status === 'fulfilled') {
          const v = eventsRes.value;
          setEvents(Array.isArray(v) ? v : ((v as { items?: OntologyChangeEvent[] }).items ?? []));
        }
        if (capsRes.status === 'fulfilled') setCapabilities(capsRes.value.items);
        if (appsRes.status === 'fulfilled') setApplications(appsRes.value.items);
        if (conceptsRes.status === 'fulfilled') {
          const v = conceptsRes.value;
          setConcepts(Array.isArray(v) ? v : ((v as { items?: OntologyConcept[] }).items ?? []));
        }
      })
      .finally(() => setLoading(false));

    getOntologyMappings()
      .then(setMappings)
      .catch(() => setMappings([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleImpact = useCallback((result: ImpactAnalysisResult) => {
    Modal.info({
      title: '影响分析',
      content: (
        <div>
          <Tag color={result.riskLevel === 'high' ? 'red' : result.riskLevel === 'medium' ? 'orange' : 'green'}>
            风险等级: {result.riskLevel}
          </Tag>
          <Typography.Paragraph style={{ marginTop: 12 }}>
            受影响能力: {result.affectedCapabilities.length} 个
          </Typography.Paragraph>
          <Typography.Paragraph>受影响应用: {result.affectedApplications.length} 个</Typography.Paragraph>
          <Typography.Paragraph>受影响流程: {result.affectedProcesses.length} 个</Typography.Paragraph>
        </div>
      ),
    });
  }, []);

  const assetOptions = useMemo(() => {
    if (assetType === 'CAPABILITY') {
      return capabilities.map((c) => ({ label: `${c.name} (${c.code})`, value: c.capabilityId }));
    }
    if (assetType === 'APPLICATION') {
      return applications.map((a) => ({ label: `${a.name} (${a.code})`, value: a.appId }));
    }
    return [];
  }, [assetType, capabilities, applications]);

  const conceptOptions = useMemo(
    () => concepts.map((c) => ({ label: `${c.name} (${c.id})`, value: c.id })),
    [concepts]
  );

  const handleCreate = async () => {
    const values = await form.validate();
    const assetName =
      assetType === 'CAPABILITY'
        ? capabilities.find((c) => c.capabilityId === values.assetId)?.name
        : applications.find((a) => a.appId === values.assetId)?.name;
    const payload = { ...values, assetName };

    if (editing) {
      await updateMappingRule(editing.id, payload);
      Toast.success('更新成功');
    } else {
      await createMappingRule(payload);
      Toast.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.reset();
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteMappingRule(id);
    Toast.success('删除成功');
    load();
  };

  const handleSync = async (direction: 'to' | 'from') => {
    setSyncing(true);
    const result = direction === 'to' ? await syncToOntology() : await syncFromOntology();
    Toast.success(result.summary);
    load();
    setSyncing(false);
  };

  const handleResolve = async (id: string) => {
    await resolveChange(id);
    Toast.success('已标记为已处理');
    load();
  };

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setModalOpen(true);
  };

  const openEdit = (rule: ConceptMappingRule) => {
    setEditing(rule);
    form.setValues({
      assetType: rule.assetType,
      assetId: rule.assetId,
      conceptId: rule.conceptId,
      conceptCode: rule.conceptCode,
      mappingType: rule.mappingType,
      description: rule.description,
      metadata: rule.metadata,
    });
    setModalOpen(true);
  };

  const ruleColumns = [
    {
      title: '资产类型',
      dataIndex: 'assetType',
      key: 'assetType',
      render: (t: string) => <Tag color={ASSET_TYPE_TAG[t]?.color}>{ASSET_TYPE_TAG[t]?.label || t}</Tag>,
    },
    { title: '架构资产', dataIndex: 'assetName', key: 'assetName', render: (v?: string, r?: ConceptMappingRule) => v || r?.assetId },
    {
      title: 'Ontology 概念',
      dataIndex: 'conceptId',
      key: 'conceptId',
      render: (_: string, r: ConceptMappingRule) => (
        <a href={conceptDetailUrl(r.conceptId)} target="_blank" rel="noreferrer">
          {r.conceptCode || r.conceptId} <LinkOutlined />
        </a>
      ),
    },
    {
      title: '映射类型',
      dataIndex: 'mappingType',
      key: 'mappingType',
      render: (t: string) => <Tag color={MAPPING_TYPE_TAG[t]?.color}>{MAPPING_TYPE_TAG[t]?.label || t}</Tag>,
    },
    { title: '说明', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: ConceptMappingRule) => (
        <Space>
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const eventColumns = [
    {
      title: '概念',
      dataIndex: 'conceptName',
      key: 'conceptName',
      render: (v: string | undefined, r: OntologyChangeEvent) => (
        <a href={conceptDetailUrl(r.conceptId)} target="_blank" rel="noreferrer">
          {v || r.conceptCode || r.conceptId} <LinkOutlined />
        </a>
      ),
    },
    { title: '变更类型', dataIndex: 'changeType', key: 'changeType' },
    {
      title: '资产',
      key: 'asset',
      render: (_: unknown, r: OntologyChangeEvent) => `${ASSET_TYPE_TAG[r.assetType || '']?.label || r.assetType}/${r.assetId || '-'}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'PENDING' ? 'orange' : 'grey'}>{s === 'PENDING' ? '待处理' : '已处理'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: OntologyChangeEvent) =>
        r.status === 'PENDING' ? (
          <Button theme="borderless" type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleResolve(r.id)}>
            标记已处理
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <Card title="能力-本体映射可视化">
        <OntologyMappingGraph mappings={mappings} onImpact={handleImpact} />
      </Card>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card
            title="映射规则"
            bodyStyle={{ padding: 12 }}
            headerExtraContent={
              <Space>
                <Button loading={syncing} icon={<SyncOutlined />} onClick={() => handleSync('to')}>
                  同步到本体
                </Button>
                <Button loading={syncing} icon={<SyncOutlined />} onClick={() => handleSync('from')}>
                  从本体同步
                </Button>
                <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  新增映射
                </Button>
              </Space>
            }
          >
            <Table
              rowKey="id"
              columns={ruleColumns}
              dataSource={rules ?? []}
              loading={loading}
              size="small"
              pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="本体变更联动（待处理）" bodyStyle={{ padding: 12 }}>
            <Table
              rowKey="id"
              columns={eventColumns}
              dataSource={(events ?? []).filter((e) => e.status === 'PENDING')}
              loading={loading}
              size="small"
              pagination={{ pageSize: 5 }}
             scroll={{ x: 'max-content' }}/>
          </Card>
        </Col>
      </Row>

      <Modal
        title={editing ? '编辑映射规则' : '新增映射规则'}
        visible={modalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.reset();
        }}
      >
        <Form
          form={form}
          onValueChange={(values) => setAssetType(values.assetType as string | undefined)}
        >
          <Form.Select
            field="assetType"
            label="资产类型"
            rules={[{ required: true, message: '请选择资产类型' }]}
            placeholder="选择资产类型"
            optionList={[
              { label: '业务能力', value: 'CAPABILITY' },
              { label: '应用系统', value: 'APPLICATION' },
            ]}
          />
          <Form.Select
            field="assetId"
            label="架构资产"
            rules={[{ required: true, message: '请选择架构资产' }]}
            filter
            placeholder="选择资产"
            disabled={!assetType}
            optionList={assetOptions}
          />
          <Form.Select
            field="conceptId"
            label="Ontology 概念"
            rules={[{ required: true, message: '请选择 Ontology 概念' }]}
            filter
            placeholder="选择概念"
            optionList={conceptOptions}
          />
          <Form.Select
            field="mappingType"
            label="映射类型"
            rules={[{ required: true, message: '请选择映射类型' }]}
            initValue="DIRECT"
            placeholder="选择映射类型"
            optionList={[
              { label: '直接映射', value: 'DIRECT' },
              { label: '派生映射', value: 'DERIVED' },
              { label: '抽象映射', value: 'ABSTRACT' },
            ]}
          />
          <Form.TextArea field="description" label="说明" rows={2} />
          <Form.TextArea field="metadata" label="元数据（JSON）" rows={2} placeholder="{}" />
        </Form>
      </Modal>
    </div>
  );
}
