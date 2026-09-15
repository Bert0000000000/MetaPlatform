import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Space, Tabs, Tag, Toast } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import {
  createDomain,
  createEntity,
  deleteDomain,
  deleteEntity,
  listDomains,
  listEntities,
} from '@/api/arch/dataArchitecture';
import type { DataDomain, DataEntity } from '@/api/arch/types';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
} from '@/components/skeleton';

interface EntityDraft {
  name: string;
  code: string;
  domainId?: string;
  entityType?: string;
  description?: string;
}

interface DomainDraft {
  name: string;
  code: string;
  description?: string;
}

/**
 * 数据实体（DESIGN-SPEC §5 版式 E：表格页 + 抽屉表单）。
 * 数据面沿用 src/api/arch/dataArchitecture；字段编辑走 /gov/data/entities/:id 详情页。
 */
export default function DataArchPage() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<DataDomain[]>([]);
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [domainFilter, setDomainFilter] = useState<string | undefined>();
  const [view, setView] = useState<'entities' | 'domains'>('entities');
  const [entityDraft, setEntityDraft] = useState<EntityDraft | null>(null);
  const [domainDraft, setDomainDraft] = useState<DomainDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [entityForm] = Form.useForm<EntityDraft>();
  const [domainForm] = Form.useForm<DomainDraft>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [domainRes, entityRes] = await Promise.allSettled([listDomains(), listEntities()]);
    setDomains(domainRes.status === 'fulfilled' ? (domainRes.value ?? []) : []);
    setEntities(entityRes.status === 'fulfilled' ? (entityRes.value ?? []) : []);
    if (entityRes.status === 'rejected') {
      setError(entityRes.reason instanceof Error ? entityRes.reason.message : String(entityRes.reason));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const domainName = useCallback(
    (id: string | undefined) => (id ? domains.find((d) => d.id === id)?.name ?? id : '—'),
    [domains],
  );

  const openEntityCreate = () => {
    setEntityDraft({ name: '', code: '', domainId: domainFilter });
    entityForm.reset();
  };

  const submitEntity = async () => {
    if (!entityDraft) return;
    let values: EntityDraft;
    try {
      values = (await entityForm.validate()) as EntityDraft;
    } catch {
      return;
    }
    setSaving(true);
    try {
      await createEntity({ ...values, fields: [] });
      Toast.success('实体已创建');
      setEntityDraft(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeEntity = async (entity: DataEntity) => {
    try {
      await deleteEntity(entity.id);
      Toast.success('实体已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openDomainCreate = () => {
    setDomainDraft({ name: '', code: '' });
    domainForm.reset();
  };

  const submitDomain = async () => {
    if (!domainDraft) return;
    let values: DomainDraft;
    try {
      values = (await domainForm.validate()) as DomainDraft;
    } catch {
      return;
    }
    setSaving(true);
    try {
      await createDomain(values);
      Toast.success('数据域已创建');
      setDomainDraft(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeDomain = async (domain: DataDomain) => {
    try {
      await deleteDomain(domain.id);
      Toast.success('数据域已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const visibleEntities = useMemo(() => {
    let rows = entities;
    if (domainFilter) rows = rows.filter((e) => e.domainId === domainFilter);
    if (keyword) {
      const q = keyword.toLowerCase();
      rows = rows.filter(
        (e) => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [entities, domainFilter, keyword]);

  const visibleDomains = useMemo(
    () =>
      keyword
        ? domains.filter(
            (d) =>
              d.name.toLowerCase().includes(keyword.toLowerCase()) ||
              d.code.toLowerCase().includes(keyword.toLowerCase()),
          )
        : domains,
    [domains, keyword],
  );

  const entityColumns = useMemo(
    () => [
      { title: '实体名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
      { title: '编码', dataIndex: 'code', key: 'code', width: 160, ellipsis: true },
      {
        title: '所属域',
        dataIndex: '__domain__',
        key: 'domain',
        width: 180,
        render: (_: unknown, row: DataEntity) => <Tag size="small" type="light">{domainName(row.domainId)}</Tag>,
      },
      {
        title: '字段数',
        dataIndex: '__fieldCount__',
        key: 'fieldCount',
        width: 100,
        render: (_: unknown, row: DataEntity) => row.fields?.length ?? 0,
      },
      { title: '类型', dataIndex: 'entityType', key: 'entityType', width: 160, ellipsis: true },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 180,
        render: (_: unknown, row: DataEntity) => (
          <Space>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => navigate(`/gov/data/entities/${row.id}`)}
            >
              字段编辑
            </Button>
            <Popconfirm title="确认删除该实体？" onConfirm={() => void removeEntity(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domainName, navigate],
  );

  const domainColumns = useMemo(
    () => [
      { title: '名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
      { title: '编码', dataIndex: 'code', key: 'code', width: 160, ellipsis: true },
      { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 100,
        render: (_: unknown, row: DataDomain) => (
          <Popconfirm title="确认删除该数据域？" onConfirm={() => void removeDomain(row)}>
            <Button theme="borderless" type="danger" size="small">
              删除
            </Button>
          </Popconfirm>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <PageHeader
        title="数据实体"
        desc={`${entities.length} 个实体 · ${domains.length} 个数据域`}
        actions={
          <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
            刷新
          </Button>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索名称、编码…' }}
        filters={
          view === 'entities' ? (
            <Select
              value={domainFilter ?? ''}
              onChange={(v) => setDomainFilter(v ? String(v) : undefined)}
              placeholder="全部数据域"
            >
              <Select.Option value="">全部数据域</Select.Option>
              {domains.map((d) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>
          ) : null
        }
        right={
          <Button
            theme="solid"
            type="primary"
            icon={<Plus size={15} strokeWidth={1.5} />}
            onClick={view === 'entities' ? openEntityCreate : openDomainCreate}
          >
            {view === 'entities' ? '新建实体' : '新建数据域'}
          </Button>
        }
      />

      <Tabs type="button" activeKey={view} onChange={(k) => setView(k as 'entities' | 'domains')}>
        <Tabs.TabPane itemKey="entities" tab="数据实体">
          <DataTablePro<DataEntity>
            columns={entityColumns}
            dataSource={visibleEntities}
            rowKey="id"
            loading={loading}
            empty={
              error ? (
                <EmptyState illustration="failure" title="数据实体加载失败" desc={error} />
              ) : (
                <EmptyState
                  illustration="no-result"
                  title="没有匹配的数据实体"
                  desc="调整数据域或关键词，或新建一个实体。"
                />
              )
            }
          />
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="domains" tab="数据域">
          <DataTablePro<DataDomain>
            columns={domainColumns}
            dataSource={visibleDomains}
            rowKey="id"
            loading={loading}
            empty={
              error ? (
                <EmptyState illustration="failure" title="数据域加载失败" desc={error} />
              ) : (
                <EmptyState
                  illustration="no-result"
                  title="没有匹配的数据域"
                  desc="新建数据域后，实体即可归属到域。"
                />
              )
            }
          />
        </Tabs.TabPane>
      </Tabs>

      <SheetDetail
        title="新建数据实体"
        open={entityDraft !== null}
        onClose={() => setEntityDraft(null)}
        footer={
          <>
            <Button onClick={() => setEntityDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitEntity()}>
              保存
            </Button>
          </>
        }
      >
        {entityDraft ? (
          <Form form={entityForm} key="entity-new" initValues={entityDraft} labelPosition="top">
            <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
            <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} />
            <Form.Select
              field="domainId"
              label="数据域"
              showClear
              optionList={domains.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Form.Input field="entityType" label="实体类型" placeholder="如 MASTER_DATA / TRANSACTIONAL" />
            <Form.Input field="description" label="描述" />
          </Form>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title="新建数据域"
        open={domainDraft !== null}
        onClose={() => setDomainDraft(null)}
        footer={
          <>
            <Button onClick={() => setDomainDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitDomain()}>
              保存
            </Button>
          </>
        }
      >
        {domainDraft ? (
          <Form form={domainForm} key="domain-new" initValues={domainDraft} labelPosition="top">
            <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
            <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} />
            <Form.Input field="description" label="描述" />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
