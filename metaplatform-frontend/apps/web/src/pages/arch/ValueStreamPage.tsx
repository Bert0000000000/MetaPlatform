import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Space, Steps, Tag, Toast } from '@douyinfe/semi-ui';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createStage,
  createValueStream,
  deleteStage,
  deleteValueStream,
  listStages,
  listValueStreams,
  updateStage,
  updateValueStream,
} from '@/api/arch/valueStreams';
import { listCapabilities } from '@/api/arch/capabilities';
import { listRoles } from '@/api/arch/roles';
import type { Capability, ArchRole, ValueStream, ValueStreamStage } from '@/api/arch/types';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
} from '@/components/skeleton';

interface StreamDraft {
  id?: string;
  name: string;
  code: string;
  description?: string;
  triggerEvent?: string;
  terminationEvent?: string;
  status?: 'ACTIVE' | 'DRAFT';
}

interface StageDraft {
  id?: string;
  name: string;
  description?: string;
  sortOrder?: number;
  capabilityIds?: string[];
  outputs?: string[];
  participantRoleIds?: string[];
}

const isActive = (status: ValueStream['status']): boolean =>
  typeof status === 'string' && status.toUpperCase() === 'ACTIVE';

/** 后端可能返回裸数组或 {items} 信封，统一成数组。 */
function normalize<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const bag = raw as { items?: T[] } | null | undefined;
  return bag?.items ?? [];
}

/**
 * 价值流（DESIGN-SPEC §5 版式 E：表格页 + 抽屉详情/阶段管理）。
 * 数据面沿用 src/api/arch/valueStreams，阶段来自 listStages。
 */
export default function ValueStreamPage() {
  const [streams, setStreams] = useState<ValueStream[]>([]);
  const [stages, setStages] = useState<ValueStreamStage[]>([]);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [roles, setRoles] = useState<ArchRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<ValueStream | null>(null);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [streamDraft, setStreamDraft] = useState<StreamDraft | null>(null);
  const [stageDraft, setStageDraft] = useState<StageDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [streamForm] = Form.useForm<StreamDraft>();
  const [stageForm] = Form.useForm<StageDraft>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [streamRes, capRes, roleRes] = await Promise.allSettled([
      listValueStreams(),
      listCapabilities(),
      listRoles(),
    ]);
    setStreams(streamRes.status === 'fulfilled' ? normalize<ValueStream>(streamRes.value) : []);
    setCaps(capRes.status === 'fulfilled' ? (capRes.value.items ?? []) : []);
    setRoles(roleRes.status === 'fulfilled' ? (roleRes.value.items ?? []) : []);
    if (streamRes.status === 'rejected') {
      setError(streamRes.reason instanceof Error ? streamRes.reason.message : String(streamRes.reason));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadStages = useCallback(async (vs: ValueStream) => {
    setStagesLoading(true);
    try {
      const data = await listStages(vs.id);
      setStages(Array.isArray(data) ? data : ((data as { items?: ValueStreamStage[] }).items ?? []));
    } catch (e) {
      setStages([]);
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setStagesLoading(false);
    }
  }, []);

  const openDetail = useCallback(
    (vs: ValueStream) => {
      setDetail(vs);
      void loadStages(vs);
    },
    [loadStages],
  );

  const openStreamCreate = () => {
    setStreamDraft({ name: '', code: '', status: 'DRAFT' });
    streamForm.reset();
  };

  const openStreamEdit = (vs: ValueStream) => {
    const upper = typeof vs.status === 'string' ? vs.status.toUpperCase() : undefined;
    setStreamDraft({
      id: vs.id,
      name: vs.name,
      code: vs.code,
      description: vs.description,
      triggerEvent: vs.triggerEvent,
      terminationEvent: vs.terminationEvent,
      status: upper === 'ACTIVE' || upper === 'DRAFT' ? upper : 'DRAFT',
    });
  };

  const submitStream = async () => {
    if (!streamDraft) return;
    let values: StreamDraft;
    try {
      values = (await streamForm.validate()) as StreamDraft;
    } catch {
      return;
    }
    setSaving(true);
    try {
      if (streamDraft.id) {
        await updateValueStream(streamDraft.id, {
          name: values.name,
          description: values.description,
          triggerEvent: values.triggerEvent,
          terminationEvent: values.terminationEvent,
          status: values.status,
        });
        Toast.success('价值流已更新');
      } else {
        await createValueStream({
          name: values.name,
          code: values.code,
          description: values.description,
          triggerEvent: values.triggerEvent,
          terminationEvent: values.terminationEvent,
          status: values.status,
        });
        Toast.success('价值流已创建');
      }
      setStreamDraft(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeStream = async (vs: ValueStream) => {
    try {
      await deleteValueStream(vs.id);
      Toast.success('价值流已删除');
      if (detail?.id === vs.id) setDetail(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openStageCreate = () => {
    setStageDraft({ name: '', sortOrder: stages.length + 1 });
    stageForm.reset();
  };

  const openStageEdit = (stage: ValueStreamStage) => {
    setStageDraft({
      id: stage.id,
      name: stage.name,
      description: stage.description,
      sortOrder: stage.sortOrder,
      capabilityIds: stage.capabilityIds ?? [],
      outputs: stage.outputs ?? [],
      participantRoleIds: stage.participantRoleIds ?? [],
    });
  };

  const submitStage = async () => {
    if (!stageDraft || !detail) return;
    let values: StageDraft;
    try {
      values = (await stageForm.validate()) as StageDraft;
    } catch {
      return;
    }
    setSaving(true);
    try {
      if (stageDraft.id) {
        await updateStage(detail.id, stageDraft.id, values);
        Toast.success('阶段已更新');
      } else {
        await createStage(detail.id, {
          name: values.name,
          description: values.description,
          sortOrder: values.sortOrder,
          capabilityIds: values.capabilityIds,
          outputs: values.outputs,
          participantRoleIds: values.participantRoleIds,
        });
        Toast.success('阶段已创建');
      }
      setStageDraft(null);
      await loadStages(detail);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeStage = async (stage: ValueStreamStage) => {
    if (!detail) return;
    try {
      await deleteStage(detail.id, stage.id);
      Toast.success('阶段已删除');
      await loadStages(detail);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const visibleStreams = useMemo(
    () =>
      keyword
        ? streams.filter(
            (s) =>
              s.name.toLowerCase().includes(keyword.toLowerCase()) ||
              s.code.toLowerCase().includes(keyword.toLowerCase()),
          )
        : streams,
    [streams, keyword],
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [stages],
  );

  const capName = useCallback(
    (id: string) => caps.find((c) => c.capabilityId === id)?.name ?? id,
    [caps],
  );
  const roleName = useCallback((id: string) => roles.find((r) => r.id === id)?.name ?? id, [roles]);

  const streamColumns = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 220,
        ellipsis: true,
        render: (v: string, row: ValueStream) => (
          <Button theme="borderless" type="primary" size="small" onClick={() => openDetail(row)}>
            {v}
          </Button>
        ),
      },
      { title: '编码', dataIndex: 'code', key: 'code', width: 150, ellipsis: true },
      { title: '触发事件', dataIndex: 'triggerEvent', key: 'triggerEvent', ellipsis: true },
      { title: '终止事件', dataIndex: 'terminationEvent', key: 'terminationEvent', ellipsis: true },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (v: ValueStream['status']) => (
          <Tag color={!v ? 'grey' : isActive(v) ? 'green' : 'grey'} type="light">
            {!v ? '—' : isActive(v) ? '生效' : '草稿'}
          </Tag>
        ),
      },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 140,
        render: (_: unknown, row: ValueStream) => (
          <Space>
            <Button theme="borderless" type="primary" size="small" onClick={() => openStreamEdit(row)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该价值流？" onConfirm={() => void removeStream(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openDetail],
  );

  const stageColumns = useMemo(
    () => [
      { title: '阶段', dataIndex: 'name', key: 'name', ellipsis: true },
      { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 70 },
      {
        title: '产出物',
        dataIndex: '__outputs__',
        key: 'outputs',
        render: (_: unknown, row: ValueStreamStage) => (
          <Space>
            {(row.outputs ?? []).map((o) => (
              <Tag key={o} type="light">
                {o}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '参与角色',
        dataIndex: '__roles__',
        key: 'roles',
        render: (_: unknown, row: ValueStreamStage) => (
          <Space>
            {(row.participantRoleIds ?? []).map((id) => (
              <Tag key={id} type="light">
                {roleName(id)}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 120,
        render: (_: unknown, row: ValueStreamStage) => (
          <Space>
            <Button theme="borderless" type="primary" size="small" onClick={() => openStageEdit(row)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该阶段？" onConfirm={() => void removeStage(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roleName],
  );

  return (
    <>
      <PageHeader
        title="价值流"
        desc={`${streams.length} 条价值流 · 点名称查看阶段编排`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openStreamCreate}>
              新建价值流
            </Button>
          </>
        }
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: '搜索价值流名称、编码…' }} />

      <DataTablePro<ValueStream>
        columns={streamColumns}
        dataSource={visibleStreams}
        rowKey="id"
        loading={loading}
        empty={
          error ? (
            <EmptyState illustration="failure" title="价值流加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-result"
              title="没有匹配的价值流"
              desc="调整关键词，或新建第一条价值流。"
            />
          )
        }
      />

      <SheetDetail
        title={detail ? `价值流详情 · ${detail.name}` : '价值流详情'}
        open={detail !== null}
        onClose={() => setDetail(null)}
        footer={
          <>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openStageCreate}>
              新增阶段
            </Button>
            <Button onClick={() => setDetail(null)}>关闭</Button>
          </>
        }
      >
        {detail ? (
          <>
            {sortedStages.length > 0 ? (
              <Steps current={sortedStages.length - 1} direction="vertical">
                {sortedStages.map((s) => (
                  <Steps.Step key={s.id} title={s.name} description={s.description} />
                ))}
              </Steps>
            ) : (
              <EmptyState
                illustration={stagesLoading ? 'idle' : 'no-content'}
                title={stagesLoading ? '正在加载阶段…' : '暂无阶段'}
                desc={stagesLoading ? undefined : '为这条价值流新增阶段后，会按排序形成编排。'}
              />
            )}
            <DataTablePro<ValueStreamStage>
              columns={stageColumns}
              dataSource={sortedStages}
              rowKey="id"
              loading={stagesLoading}
              columnSettings={false}
              scroll={{ x: 'max-content' }}
              empty={<EmptyState illustration="no-content" title="暂无阶段" />}
            />
          </>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={streamDraft?.id ? `编辑价值流 · ${streamDraft.name}` : '新建价值流'}
        open={streamDraft !== null}
        onClose={() => setStreamDraft(null)}
        footer={
          <>
            <Button onClick={() => setStreamDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitStream()}>
              保存
            </Button>
          </>
        }
      >
        {streamDraft ? (
          <Form form={streamForm} key={streamDraft.id ?? 'new'} initValues={streamDraft} labelPosition="top">
            <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
            <Form.Input field="code" label="编码" disabled={Boolean(streamDraft.id)} rules={[{ required: true, message: '请输入编码' }]} />
            <Form.Input field="description" label="描述" />
            <Form.Input field="triggerEvent" label="触发事件" />
            <Form.Input field="terminationEvent" label="终止事件" />
            <Form.Select
              field="status"
              label="状态"
              optionList={[
                { value: 'ACTIVE', label: '生效' },
                { value: 'DRAFT', label: '草稿' },
              ]}
            />
          </Form>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={stageDraft?.id ? '编辑阶段' : '新增阶段'}
        open={stageDraft !== null}
        onClose={() => setStageDraft(null)}
        footer={
          <>
            <Button onClick={() => setStageDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitStage()}>
              保存
            </Button>
          </>
        }
      >
        {stageDraft ? (
          <Form form={stageForm} key={stageDraft.id ?? 'new'} initValues={stageDraft} labelPosition="top">
            <Form.Input field="name" label="阶段名称" rules={[{ required: true, message: '请输入阶段名称' }]} />
            <Form.TextArea field="description" label="描述" rows={2} />
            <Form.InputNumber field="sortOrder" label="排序" />
            <Form.Select
              field="capabilityIds"
              label="关联能力"
              multiple
              optionList={caps.map((c) => ({ value: c.capabilityId, label: c.name }))}
            />
            <Form.TagInput field="outputs" label="产出物" placeholder="输入产出物，按回车确认" separator="," />
            <Form.Select
              field="participantRoleIds"
              label="参与角色"
              multiple
              optionList={roles.map((r) => ({ value: r.id, label: r.name }))}
            />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
