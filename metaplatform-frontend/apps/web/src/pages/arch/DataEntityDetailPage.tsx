import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { getEntity, updateEntity } from '@/api/arch/dataArchitecture';
import type { DataEntity, DataField } from '@/api/arch/types';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';

const FIELD_TYPES = ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON', 'TEXT'];

type FieldRow = DataField & { __key: string };

let seq = 0;
const nextKey = (): string => `f${(seq += 1)}`;

/**
 * 数据实体详情（DESIGN-SPEC §5 版式 D：详情头 + 字段编辑表格）。
 * 数据面沿用 src/api/arch/dataArchitecture 的 getEntity / updateEntity。
 */
export default function DataEntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<DataEntity | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('缺少实体 ID');
      return;
    }
    setLoading(true);
    setError('');
    getEntity(id)
      .then((raw) => {
        // 后端详情返回 {code,data,message} 信封；列表里 fields 是字符串数组，统一成 DataField。
        const env = raw as unknown as { data?: DataEntity };
        const e = env.data ?? (raw as DataEntity);
        setEntity(e);
        const rawFields = (e.fields ?? []) as unknown[];
        setFields(
          rawFields.map((f) =>
            typeof f === 'string'
              ? { name: f, type: 'STRING', required: false, __key: nextKey() }
              : { ...(f as DataField), __key: nextKey() },
          ),
        );
      })
      .catch((err: unknown) => {
        setEntity(null);
        setFields([]);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!id || !entity) return;
    setSaving(true);
    try {
      await updateEntity(id, {
        ...entity,
        fields: fields.map((f) => ({
          name: f.name,
          type: f.type,
          length: f.length,
          required: f.required,
          defaultValue: f.defaultValue,
          description: f.description,
        })),
      });
      Toast.success('保存成功');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { __key: nextKey(), name: '', type: 'STRING', required: false, description: '' },
    ]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = useCallback((index: number, patch: Partial<DataField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }, []);

  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
  };

  const columns = useMemo(
    () => [
      {
        title: '',
        dataIndex: '__drag__',
        key: 'drag',
        width: 40,
        render: () => <GripVertical size={15} strokeWidth={1.5} />,
      },
      {
        title: '字段名',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (v: string, _row: FieldRow, index: number) => (
          <Input value={v} placeholder="字段名" onChange={(val) => updateField(index, { name: val })} />
        ),
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 150,
        render: (v: string, _row: FieldRow, index: number) => (
          <Select
            value={v}
            optionList={FIELD_TYPES.map((t) => ({ label: t, value: t }))}
            onChange={(val) => updateField(index, { type: String(val) })}
          />
        ),
      },
      {
        title: '长度',
        dataIndex: 'length',
        key: 'length',
        width: 110,
        render: (v: number | undefined, _row: FieldRow, index: number) => (
          <InputNumber
            value={v}
            placeholder="长度"
            onChange={(val) =>
              updateField(index, {
                length: val === null || val === undefined || val === '' ? undefined : Number(val),
              })
            }
          />
        ),
      },
      {
        title: '必填',
        dataIndex: 'required',
        key: 'required',
        width: 90,
        render: (v: boolean | undefined, _row: FieldRow, index: number) => (
          <Switch checked={Boolean(v)} onChange={(val) => updateField(index, { required: val })} />
        ),
      },
      {
        title: '默认值',
        dataIndex: 'defaultValue',
        key: 'defaultValue',
        width: 160,
        render: (v: string | undefined, _row: FieldRow, index: number) => (
          <Input value={v} placeholder="默认值" onChange={(val) => updateField(index, { defaultValue: val })} />
        ),
      },
      {
        title: '注释',
        dataIndex: 'description',
        key: 'description',
        render: (v: string | undefined, _row: FieldRow, index: number) => (
          <Input value={v} placeholder="注释" onChange={(val) => updateField(index, { description: val })} />
        ),
      },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 70,
        render: (_: unknown, _row: FieldRow, index: number) => (
          <Popconfirm title="确认删除该字段？" onConfirm={() => removeField(index)}>
            <Button theme="borderless" type="danger" size="small" icon={<Trash2 size={15} strokeWidth={1.5} />} />
          </Popconfirm>
        ),
      },
    ],
    [updateField],
  );

  return (
    <>
      <PageHeader
        title={entity ? `${entity.name}（${entity.code}）` : '数据实体详情'}
        desc={entity ? `所属域 ${entity.domainId ?? '—'} · ${fields.length} 个字段` : '字段编辑'}
        actions={
          <>
            <Button
              icon={<ArrowLeft size={15} strokeWidth={1.5} />}
              onClick={() => navigate('/gov/data')}
            >
              返回
            </Button>
            <Button icon={<Plus size={15} strokeWidth={1.5} />} onClick={addField}>
              添加字段
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Save size={15} strokeWidth={1.5} />}
              loading={saving}
              disabled={!entity}
              onClick={() => void save()}
            >
              保存
            </Button>
          </>
        }
      />

      {error ? (
        <EmptyState illustration="failure" title="数据实体加载失败" desc={error} />
      ) : entity ? (
        <>
          <Space vertical align="start">
            <span className="mp-pane-title">描述</span>
            <TextArea
              value={entity.description ?? ''}
              rows={2}
              placeholder="实体描述"
              onChange={(val) => setEntity((prev) => (prev ? { ...prev, description: val } : prev))}
            />
          </Space>
          <DataTablePro<FieldRow>
            columns={columns}
            dataSource={fields}
            rowKey="__key"
            loading={loading}
            columnSettings={false}
            onRow={(_record, index) => ({
              draggable: true,
              onDragStart: () => setDragIndex(index ?? 0),
              onDragOver: (e: React.DragEvent<HTMLTableRowElement>) => onDragOver(e, index ?? 0),
              onDragEnd: () => setDragIndex(null),
            })}
            empty={<EmptyState illustration="no-content" title="还没有字段" desc="点击「添加字段」开始定义结构。" />}
          />
        </>
      ) : (
        <EmptyState illustration="no-content" title={loading ? '正在加载实体…' : '未找到实体'} />
      )}
    </>
  );
}
