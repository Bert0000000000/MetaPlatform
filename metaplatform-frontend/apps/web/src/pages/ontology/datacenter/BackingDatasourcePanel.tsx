import { useCallback, useEffect, useState } from 'react';
import { Button, Input, InputNumber, Select, Tag, Toast } from '@douyinfe/semi-ui';
import { Database, Plus, RefreshCw, Trash2, Zap } from 'lucide-react';
import {
  listBackingDatasources,
  listObjectTypes,
  syncBackingDatasources,
  upsertBackingDatasource,
  type KernelBackingDatasource,
  type KernelObjectType,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState, SheetDetail } from '@/components/skeleton';
import { ridTail } from '../rid';
import './datacenter.css';

/**
 * 背挂数据源（DATA-14/15）。
 * 「某个对象类型的数据从哪张表来」——声明数据源 + 字段映射（属性 → 列），然后手动触发同步。
 *
 * 2026-09-17 IA 重排：此前这块只有后端端点，前端无入口；随「数据接入」一起归到数据中心。
 */
type MappingRow = { key: string; value: string };

export default function BackingDatasourcePanel() {
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [classRid, setClassRid] = useState('');

  const [rows, setRows] = useState<KernelBackingDatasource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [declareOpen, setDeclareOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // 声明表单
  const [name, setName] = useState('');
  const [kind, setKind] = useState('postgres');
  const [table, setTable] = useState('');
  const [pkColumn, setPkColumn] = useState('');
  const [tsColumn, setTsColumn] = useState('');
  const [priority, setPriority] = useState(0);
  const [mapping, setMapping] = useState<MappingRow[]>([{ key: '', value: '' }]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listObjectTypes();
        if (!alive) return;
        setTypes(list);
        if (list.length > 0) setClassRid((cur) => cur || list[0].rid);
      } catch {
        // 类型清单失败不阻断；下拉为空时给空态
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!classRid) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setRows(await listBackingDatasources(classRid));
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [classRid]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setName('');
    setKind('postgres');
    setTable('');
    setPkColumn('');
    setTsColumn('');
    setPriority(0);
    setMapping([{ key: '', value: '' }]);
  };

  const submitDeclare = async () => {
    if (!classRid) return;
    if (!name.trim() || !table.trim() || !pkColumn.trim()) {
      Toast.warning('源名、表名、主键列为必填');
      return;
    }
    const fieldMapping: Record<string, string> = {};
    for (const m of mapping) {
      if (m.key.trim()) fieldMapping[m.key.trim()] = m.value.trim();
    }
    setSaving(true);
    try {
      await upsertBackingDatasource(classRid, {
        class_rid: classRid,
        name: name.trim(),
        kind: kind.trim() || undefined,
        table: table.trim(),
        pk_column: pkColumn.trim(),
        field_mapping: fieldMapping,
        priority,
      });
      Toast.success('数据源已声明');
      setDeclareOpen(false);
      resetForm();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const doSync = async (incremental: boolean) => {
    if (!classRid) return;
    setSyncing(true);
    try {
      const result = await syncBackingDatasources(classRid, incremental);
      const total = Object.values(result ?? {}).reduce((a, b) => a + (b ?? 0), 0);
      Toast.success(`同步完成，共 ${total} 行`);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <div className="mp-dc-ingest-bar">
        <Select
          className="mp-dc-ingest-select"
          value={classRid || undefined}
          placeholder="选择对象类型"
          filter
          onChange={(v) => setClassRid(String(v))}
          optionList={types.map((t) => ({
            value: t.rid,
            label: `${t.display_name || ridTail(t.rid)} · ${ridTail(t.rid)}`,
          }))}
        />
        <Button
          theme="solid"
          type="primary"
          icon={<Plus size={15} strokeWidth={1.5} />}
          disabled={!classRid}
          onClick={() => setDeclareOpen(true)}
        >
          声明数据源
        </Button>
        <Button
          icon={<Zap size={15} strokeWidth={1.5} />}
          disabled={!classRid || rows.length === 0}
          loading={syncing}
          onClick={() => void doSync(false)}
        >
          全量同步
        </Button>
        <Button
          icon={<RefreshCw size={15} strokeWidth={1.5} />}
          disabled={!classRid}
          loading={loading}
          onClick={() => void load()}
        >
          刷新
        </Button>
      </div>

      <DataTablePro<KernelBackingDatasource>
        columns={[
          {
            title: '源名',
            dataIndex: 'name',
            width: 200,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-strong">{v}</span>,
          },
          {
            title: '类型',
            dataIndex: 'kind',
            width: 110,
            render: (v: string) => <Tag size="small" type="light">{v || '—'}</Tag>,
          },
          {
            title: '表',
            dataIndex: 'table_name',
            width: 220,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-mono">{v || '—'}</span>,
          },
          {
            title: '主键列',
            dataIndex: 'pk_column',
            width: 140,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-mono">{v || '—'}</span>,
          },
          {
            title: '字段映射',
            dataIndex: 'field_mapping',
            width: 110,
            render: (v: Record<string, string>) => (
              <span className="mp-onto-num">{Object.keys(v ?? {}).length}</span>
            ),
          },
          {
            title: '优先级',
            dataIndex: 'priority',
            width: 90,
            sorter: (a: KernelBackingDatasource, b: KernelBackingDatasource) =>
              (a.priority ?? 0) - (b.priority ?? 0),
            render: (v: number) => <span className="mp-onto-num">{v ?? 0}</span>,
          },
          {
            title: '最近同步',
            dataIndex: 'last_synced_at',
            ellipsis: true,
            render: (v: string | null | undefined) => (
              <span className="mp-onto-muted">{v || '从未'}</span>
            ),
          },
        ]}
        dataSource={rows}
        rowKey="rid"
        loading={loading}
        empty={
          error ? (
            <EmptyState illustration="failure" title="数据源加载失败" desc={error} />
          ) : types.length === 0 ? (
            <EmptyState
              illustration="no-content"
              title="本体里还没有对象类型"
              desc="先在「概念建模」里创建对象类型，再回来给它绑数据源。"
            />
          ) : (
            <EmptyState
              illustration="no-content"
              title="该类型还没有声明背挂数据源"
              desc="声明后即可从源表同步实例数据。"
            />
          )
        }
      />

      <SheetDetail
        title="声明背挂数据源"
        open={declareOpen}
        width={560}
        onClose={() => setDeclareOpen(false)}
        footer={
          <>
            <Button onClick={() => setDeclareOpen(false)}>取消</Button>
            <Button
              theme="solid"
              type="primary"
              loading={saving}
              icon={<Database size={15} strokeWidth={1.5} />}
              onClick={() => void submitDeclare()}
            >
              声明
            </Button>
          </>
        }
      >
        <div className="mp-dc-form">
          <label className="mp-dc-field">
            <span className="mp-dc-field-label">源名</span>
            <Input value={name} onChange={setName} placeholder="例如 hr_employee" />
          </label>

          <label className="mp-dc-field">
            <span className="mp-dc-field-label">数据源类型</span>
            <Input value={kind} onChange={setKind} placeholder="postgres" />
          </label>

          <label className="mp-dc-field">
            <span className="mp-dc-field-label">表名</span>
            <Input value={table} onChange={setTable} placeholder="例如 public.employee" />
          </label>

          <label className="mp-dc-field">
            <span className="mp-dc-field-label">主键列</span>
            <Input value={pkColumn} onChange={setPkColumn} placeholder="例如 emp_id" />
          </label>

          <label className="mp-dc-field">
            <span className="mp-dc-field-label">增量水位列（可选）</span>
            <Input value={tsColumn} onChange={setTsColumn} placeholder="例如 updated_at" />
          </label>

          <label className="mp-dc-field">
            <span className="mp-dc-field-label">优先级</span>
            <InputNumber value={priority} onChange={(v) => setPriority(Number(v) || 0)} />
          </label>

          <div className="mp-dc-field">
            <span className="mp-dc-field-label">字段映射（属性 → 列）</span>
            {mapping.map((row, i) => (
              <div key={i} className="mp-dc-map-row">
                <Input
                  value={row.key}
                  placeholder="属性 slug"
                  onChange={(v) =>
                    setMapping((prev) => prev.map((m, j) => (j === i ? { ...m, key: v } : m)))
                  }
                />
                <span className="mp-dc-map-arrow">→</span>
                <Input
                  value={row.value}
                  placeholder="列名"
                  onChange={(v) =>
                    setMapping((prev) => prev.map((m, j) => (j === i ? { ...m, value: v } : m)))
                  }
                />
                <Button
                  theme="borderless"
                  type="danger"
                  icon={<Trash2 size={15} strokeWidth={1.5} />}
                  aria-label="删除该映射"
                  disabled={mapping.length === 1}
                  onClick={() => setMapping((prev) => prev.filter((_, j) => j !== i))}
                />
              </div>
            ))}
            <Button
              theme="borderless"
              type="primary"
              size="small"
              icon={<Plus size={14} strokeWidth={1.5} />}
              onClick={() => setMapping((prev) => [...prev, { key: '', value: '' }])}
            >
              添加映射
            </Button>
          </div>
        </div>
      </SheetDetail>
    </>
  );
}
