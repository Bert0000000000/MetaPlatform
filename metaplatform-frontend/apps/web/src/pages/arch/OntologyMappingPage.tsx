import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Form, Popconfirm, Select, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Check, ExternalLink, Network, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  createMappingRule,
  deleteMappingRule,
  getOntologyMappings,
  listMappingRules,
  listPendingChanges,
  resolveChange,
  syncFromOntology,
  syncToOntology,
  updateMappingRule,
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
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

/** 后端列表接口可能返回裸数组或 {items:[...]} 信封；统一解包。 */
function asItems<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items ?? []);
}

const EVENT_PAGE_SIZE = 5;

const MAPPING_TYPE_TAG: Record<string, { color: TagColor; label: string }> = {
  DIRECT: { color: 'green', label: '直接映射' },
  DERIVED: { color: 'blue', label: '派生映射' },
  ABSTRACT: { color: 'purple', label: '抽象映射' },
};

const ASSET_TYPE_TAG: Record<string, { color: TagColor; label: string }> = {
  CAPABILITY: { color: 'cyan', label: '业务能力' },
  APPLICATION: { color: 'indigo', label: '应用系统' },
};

const conceptDetailUrl = (conceptId: string) => `/ontology-studio/concepts/${conceptId}`;

const RISK_TAG: Record<string, { color: TagColor; label: string }> = {
  high: { color: 'red', label: '高风险' },
  medium: { color: 'orange', label: '中风险' },
  low: { color: 'green', label: '低风险' },
};

/**
 * 技术架构 · 能力-本体映射（/ontology-mappings）。
 * 映射规则与本体变更联动两张台账；映射关系图复用既有能力-本体映射图组件，
 * 点节点触发的影响分析在右侧浮层内展示。
 */
export default function OntologyMappingPage() {
  const [rules, setRules] = useState<ConceptMappingRule[]>([]);
  const [events, setEvents] = useState<OntologyChangeEvent[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [applications, setApplications] = useState<ArchApplication[]>([]);
  const [concepts, setConcepts] = useState<OntologyConcept[]>([]);
  const [mappings, setMappings] = useState<OntologyMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [assetFilter, setAssetFilter] = useState<string | undefined>(undefined);
  const [rulePage, setRulePage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setRulePage(1);
  }, []);

  const [draftOpen, setDraftOpen] = useState(false);
  const [editing, setEditing] = useState<ConceptMappingRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [assetType, setAssetType] = useState<string | undefined>(undefined);
  const [graphOpen, setGraphOpen] = useState(false);
  const [impact, setImpact] = useState<ImpactAnalysisResult | null>(null);
  const [form] = Form.useForm<CreateMappingRuleRequest>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      listMappingRules(),
      listPendingChanges(),
      listCapabilities(),
      listApplications(),
      searchOntologyConcepts(),
    ]);
    const [rulesRes, eventsRes, capsRes, appsRes, conceptsRes] = results;
    if (rulesRes.status === 'fulfilled') {
      setRules(asItems<ConceptMappingRule>(rulesRes.value));
    } else {
      setRules([]);
      setError(rulesRes.reason instanceof Error ? rulesRes.reason.message : String(rulesRes.reason));
    }
    if (eventsRes.status === 'fulfilled') setEvents(asItems<OntologyChangeEvent>(eventsRes.value));
    else setEvents([]);
    if (capsRes.status === 'fulfilled') setCapabilities(capsRes.value.items ?? []);
    else setCapabilities([]);
    if (appsRes.status === 'fulfilled') setApplications(appsRes.value.items ?? []);
    else setApplications([]);
    if (conceptsRes.status === 'fulfilled') setConcepts(asItems<OntologyConcept>(conceptsRes.value));
    else setConcepts([]);
    try {
      setMappings(await getOntologyMappings());
    } catch {
      setMappings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setRulePage(1);
  }, [keyword, assetFilter]);

  const filteredRules = useMemo(
    () =>
      rules.filter((r) => {
        const kw = keyword.toLowerCase();
        const matchKeyword = keyword
          ? `${r.assetName ?? ''} ${r.assetId} ${r.conceptCode ?? ''} ${r.conceptId}`.toLowerCase().includes(kw)
          : true;
        const matchAsset = assetFilter ? r.assetType === assetFilter : true;
        return matchKeyword && matchAsset;
      }),
    [rules, keyword, assetFilter],
  );

  const pendingEvents = useMemo(() => events.filter((e) => e.status === 'PENDING'), [events]);

  const pagedRules = useMemo(
    () => filteredRules.slice((rulePage - 1) * pageSize, rulePage * pageSize),
    [filteredRules, rulePage, pageSize],
  );
  const pagedEvents = useMemo(
    () => pendingEvents.slice((eventPage - 1) * EVENT_PAGE_SIZE, eventPage * EVENT_PAGE_SIZE),
    [pendingEvents, eventPage],
  );

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
    [concepts],
  );

  const handleImpact = useCallback((result: ImpactAnalysisResult) => {
    setImpact(result);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setAssetType(undefined);
    form.reset();
    setDraftOpen(true);
  };

  const openEdit = (rule: ConceptMappingRule) => {
    setEditing(rule);
    setAssetType(rule.assetType);
    form.setValues({
      assetType: rule.assetType,
      assetId: rule.assetId,
      conceptId: rule.conceptId,
      conceptCode: rule.conceptCode,
      mappingType: rule.mappingType,
      description: rule.description,
      metadata: rule.metadata,
    });
    setDraftOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const values = await form.validate();
      const assetName =
        assetType === 'CAPABILITY'
          ? capabilities.find((c) => c.capabilityId === values.assetId)?.name
          : applications.find((a) => a.appId === values.assetId)?.name;
      const payload = { ...values, assetName };
      if (editing) {
        await updateMappingRule(editing.id, payload);
        Toast.success('已更新');
      } else {
        await createMappingRule(payload);
        Toast.success('已创建');
      }
      setDraftOpen(false);
      setEditing(null);
      form.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMappingRule(id);
      Toast.success('已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSync = async (direction: 'to' | 'from') => {
    setSyncing(true);
    try {
      const result = direction === 'to' ? await syncToOntology() : await syncFromOntology();
      Toast.success(result.summary);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveChange(id);
      Toast.success('已标记为已处理');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const ruleColumns = [
    {
      title: '资产类型',
      dataIndex: 'assetType',
      key: 'assetType',
      width: 120,
      render: (t: string) => (
        <Tag color={ASSET_TYPE_TAG[t]?.color ?? 'grey'} type="light">
          {ASSET_TYPE_TAG[t]?.label ?? t}
        </Tag>
      ),
    },
    {
      title: '架构资产',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 200,
      ellipsis: true,
      render: (v: string | undefined, row: ConceptMappingRule) => v || row.assetId,
    },
    {
      title: 'Ontology 概念',
      dataIndex: 'conceptId',
      key: 'conceptId',
      width: 220,
      ellipsis: true,
      render: (_: unknown, row: ConceptMappingRule) => (
        <a href={conceptDetailUrl(row.conceptId)} target="_blank" rel="noreferrer">
          {row.conceptCode || row.conceptId}
          <ExternalLink size={12} strokeWidth={1.5} />
        </a>
      ),
    },
    {
      title: '映射类型',
      dataIndex: 'mappingType',
      key: 'mappingType',
      width: 120,
      render: (t: string) => (
        <Tag color={MAPPING_TYPE_TAG[t]?.color ?? 'grey'} type="light">
          {MAPPING_TYPE_TAG[t]?.label ?? t}
        </Tag>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 150,
      render: (_: unknown, row: ConceptMappingRule) => (
        <>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Pencil size={14} strokeWidth={1.5} />}
            onClick={() => openEdit(row)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该映射规则？"
            content="删除操作会写入审计日志。"
            onConfirm={() => void remove(row.id)}
          >
            <Button theme="borderless" type="danger" size="small" icon={<Trash2 size={14} strokeWidth={1.5} />}>
              删除
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  const eventColumns = [
    {
      title: '概念',
      dataIndex: 'conceptName',
      key: 'conceptName',
      width: 200,
      ellipsis: true,
      render: (v: string | undefined, row: OntologyChangeEvent) => (
        <a href={conceptDetailUrl(row.conceptId)} target="_blank" rel="noreferrer">
          {v || row.conceptCode || row.conceptId}
          <ExternalLink size={12} strokeWidth={1.5} />
        </a>
      ),
    },
    { title: '变更类型', dataIndex: 'changeType', key: 'changeType', width: 140, ellipsis: true },
    {
      title: '资产',
      dataIndex: '__asset__',
      key: '__asset__',
      width: 200,
      ellipsis: true,
      render: (_: unknown, row: OntologyChangeEvent) =>
        `${ASSET_TYPE_TAG[row.assetType ?? '']?.label ?? row.assetType ?? '—'}/${row.assetId || '—'}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => (
        <Tag color={s === 'PENDING' ? 'orange' : 'grey'} type="light">
          {s === 'PENDING' ? '待处理' : '已处理'}
        </Tag>
      ),
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 140,
      render: (_: unknown, row: OntologyChangeEvent) =>
        row.status === 'PENDING' ? (
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Check size={14} strokeWidth={1.5} />}
            onClick={() => void handleResolve(row.id)}
          >
            标记已处理
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="能力-本体映射"
        desc={`${rules.length} 条映射规则 · ${pendingEvents.length} 条待处理本体变更`}
        actions={
          <>
            <Button icon={<Network size={15} strokeWidth={1.5} />} onClick={() => setGraphOpen(true)}>
              查看映射图
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增映射
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索架构资产、概念…' }}
        filters={
          <Select
            value={assetFilter ?? ''}
            onChange={(v) => setAssetFilter(v ? String(v) : undefined)}
            placeholder="全部资产类型"
          >
            <Select.Option value="">全部资产类型</Select.Option>
            <Select.Option value="CAPABILITY">业务能力</Select.Option>
            <Select.Option value="APPLICATION">应用系统</Select.Option>
          </Select>
        }
        right={
          <>
            <Button loading={syncing} onClick={() => void handleSync('to')}>
              同步到本体
            </Button>
            <Button loading={syncing} onClick={() => void handleSync('from')}>
              从本体同步
            </Button>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
          </>
        }
      />

      <DataTablePro<ConceptMappingRule>
        columns={ruleColumns}
        dataSource={pagedRules}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: rulePage,
          pageSize,
          total: filteredRules.length,
          onChange: setRulePage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="映射规则加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无映射规则"
              desc="把架构资产关联到 Ontology 概念。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreate}>
                  新增映射
                </Button>
              }
            />
          )
        }
      />

      <Typography.Title heading={6}>本体变更联动（待处理）</Typography.Title>

      <DataTablePro<OntologyChangeEvent>
        columns={eventColumns}
        dataSource={pagedEvents}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: eventPage,
          pageSize: EVENT_PAGE_SIZE,
          total: pendingEvents.length,
          onChange: setEventPage,
        }}
        empty={<EmptyState illustration="no-content" title="没有待处理的本体变更" />}
      />

      <SheetDetail
        title="能力-本体映射图"
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        footer={<Button onClick={() => setGraphOpen(false)}>关闭</Button>}
      >
        <OntologyMappingGraph mappings={mappings} onImpact={handleImpact} />
      </SheetDetail>

      <SheetDetail
        title="影响分析"
        open={impact !== null}
        onClose={() => setImpact(null)}
        footer={<Button onClick={() => setImpact(null)}>关闭</Button>}
      >
        {impact ? (
          <Descriptions
            row
            data={[
              { key: '风险等级', value: RISK_TAG[impact.riskLevel]?.label ?? impact.riskLevel },
              { key: '受影响能力', value: `${impact.affectedCapabilities.length} 个` },
              { key: '受影响应用', value: `${impact.affectedApplications.length} 个` },
              { key: '受影响流程', value: `${impact.affectedProcesses.length} 个` },
            ]}
          />
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={editing ? '编辑映射规则' : '新增映射规则'}
        open={draftOpen}
        onClose={() => {
          setDraftOpen(false);
          setEditing(null);
        }}
        footer={
          <>
            <Button
              onClick={() => {
                setDraftOpen(false);
                setEditing(null);
              }}
            >
              取消
            </Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        <Form
          form={form}
          labelPosition="left"
          labelWidth={92}
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
          <Form.TextArea field="description" label="说明" rows={2} placeholder="选填" />
          <Form.TextArea field="metadata" label="元数据（JSON）" rows={2} placeholder="{}" />
        </Form>
      </SheetDetail>
    </>
  );
}
