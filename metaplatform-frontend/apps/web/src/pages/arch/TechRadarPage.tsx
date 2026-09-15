import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  createTechnologyRadar,
  deleteTechnologyRadar,
  listTechnologyRadars,
  updateTechnologyRadar,
} from '@/api/arch/technologyRadar';
import type { TechnologyRadar, TechnologyRadarItem } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

/** 后端列表接口可能返回裸数组或 {items:[...]} 信封；统一解包。 */
function asItems<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items ?? []);
}


interface TechnologyRadarFormValues {
  name: string;
  status?: 'active' | 'draft' | 'archived';
  quadrants: string;
  rings: string;
  items: string;
}

const STATUS_MAP: Record<string, { color: TagColor; label: string }> = {
  active: { color: 'green', label: '活跃' },
  draft: { color: 'blue', label: '草稿' },
  archived: { color: 'grey', label: '已归档' },
};

const TREND_MAP: Record<string, { color: TagColor; label: string }> = {
  up: { color: 'green', label: '上升' },
  down: { color: 'red', label: '下降' },
  stable: { color: 'grey', label: '平稳' },
};

/** 象限配色只取 Semi 语义令牌，深浅主题自动跟随。 */
const QUADRANT_TONES = [
  'var(--semi-color-primary)',
  'var(--semi-color-success)',
  'var(--semi-color-warning)',
  'var(--semi-color-danger)',
];

const RADAR_SIZE = 360;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_MAX_RADIUS = RADAR_SIZE / 2 - 24;

function computeItemPositions(
  items: TechnologyRadarItem[],
  quadrants: string[],
  rings: string[],
  size: number,
): Map<string, { x: number; y: number }> {
  const buckets = new Map<string, TechnologyRadarItem[]>();
  items.forEach((item) => {
    const key = `${item.quadrant}-${item.ring}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  });

  const half = size / 2;
  const usable = half - 20;
  const positions = new Map<string, { x: number; y: number }>();
  buckets.forEach((bucket, key) => {
    const [quadName, ringName] = key.split('-');
    const qi = quadrants.indexOf(quadName);
    const ri = rings.indexOf(ringName);
    if (qi < 0 || ri < 0) return;

    const quadrantStartAngle = qi * 90;
    const innerRadius = (ri * usable) / rings.length;
    const outerRadius = ((ri + 1) * usable) / rings.length;
    const count = bucket.length;
    bucket.forEach((item, idx) => {
      const col = Math.ceil(Math.sqrt(count));
      const row = Math.floor(idx / col);
      const colIdx = idx % col;
      const fracRow = count === 1 ? 0.5 : row / Math.max(col - 1, 1);
      const fracCol = count === 1 ? 0.5 : colIdx / Math.max(col - 1, 1);
      const radius = innerRadius + (outerRadius - innerRadius) * (0.25 + 0.5 * fracRow);
      const angle = quadrantStartAngle + 10 + 70 * fracCol;
      const rad = (angle * Math.PI) / 180;
      positions.set(item.id, { x: half + radius * Math.cos(rad), y: half + radius * Math.sin(rad) });
    });
  });
  return positions;
}

/**
 * 技术架构 · 技术雷达（/technology-radar）。
 * 列表承载雷达定义；「查看雷达」在右侧浮层内渲染象限-环视图与技术项清单。
 * 视图完全由后端返回的 quadrants / rings / items 驱动，不做任何默认值兜底。
 */
export default function TechRadarPage() {
  const [radars, setRadars] = useState<TechnologyRadar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const [draftOpen, setDraftOpen] = useState(false);
  const [editing, setEditing] = useState<TechnologyRadar | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewRadar, setViewRadar] = useState<TechnologyRadar | null>(null);
  const [form] = Form.useForm<TechnologyRadarFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listTechnologyRadars();
      setRadars(asItems<TechnologyRadar>(data));
    } catch (e) {
      setRadars([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  const filtered = useMemo(
    () => radars.filter((r) => (keyword ? r.name.toLowerCase().includes(keyword.toLowerCase()) : true)),
    [radars, keyword],
  );

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const viewQuadrants = viewRadar?.quadrants ?? [];
  const viewRings = viewRadar?.rings ?? [];
  const positions = useMemo(
    () => computeItemPositions(viewRadar?.items ?? [], viewQuadrants, viewRings, RADAR_SIZE),
    [viewRadar, viewQuadrants, viewRings],
  );
  const ringWidth = viewRings.length ? RADAR_MAX_RADIUS / viewRings.length : 0;

  const parseJson = (text: string): unknown => {
    try {
      return JSON.parse(text || '[]');
    } catch {
      return [];
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setDraftOpen(true);
  };

  const openEdit = (record: TechnologyRadar) => {
    setEditing(record);
    form.setValues({
      name: record.name,
      status: record.status,
      quadrants: JSON.stringify(record.quadrants ?? [], null, 2),
      rings: JSON.stringify(record.rings ?? [], null, 2),
      items: JSON.stringify(record.items ?? [], null, 2),
    });
    setDraftOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const values = await form.validate();
      const payload = {
        name: values.name,
        status: values.status,
        quadrants: parseJson(values.quadrants) as string[],
        rings: parseJson(values.rings) as string[],
        items: parseJson(values.items) as TechnologyRadarItem[],
      };
      if (editing) {
        await updateTechnologyRadar(editing.id, payload);
        Toast.success('已更新');
      } else {
        await createTechnologyRadar(payload);
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
      await deleteTechnologyRadar(id);
      Toast.success('已删除');
      if (viewRadar?.id === id) setViewRadar(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
    {
      title: '象限数',
      dataIndex: '__quadrantCount__',
      key: '__quadrantCount__',
      width: 100,
      render: (_: unknown, row: TechnologyRadar) => row.quadrants?.length ?? 0,
    },
    {
      title: '环数',
      dataIndex: '__ringCount__',
      key: '__ringCount__',
      width: 90,
      render: (_: unknown, row: TechnologyRadar) => row.rings?.length ?? 0,
    },
    {
      title: '技术项',
      dataIndex: '__itemCount__',
      key: '__itemCount__',
      width: 100,
      render: (_: unknown, row: TechnologyRadar) => row.items?.length ?? 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => (
        <Tag color={STATUS_MAP[s]?.color ?? 'grey'} type="light">
          {STATUS_MAP[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 220,
      render: (_: unknown, row: TechnologyRadar) => (
        <>
          <Button theme="borderless" type="primary" size="small" onClick={() => setViewRadar(row)}>
            查看雷达
          </Button>
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
            title="确认删除该雷达？"
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

  const itemColumns = [
    { title: '技术项', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
    { title: '象限', dataIndex: 'quadrant', key: 'quadrant', width: 130, ellipsis: true },
    { title: '环', dataIndex: 'ring', key: 'ring', width: 90 },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      width: 90,
      render: (t?: string) =>
        t ? (
          <Tag color={TREND_MAP[t]?.color ?? 'grey'} type="light">
            {TREND_MAP[t]?.label ?? t}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
  ];

  return (
    <>
      <PageHeader
        title="技术雷达"
        desc={`${radars.length} 份雷达 · 用象限与环标记技术项的采纳状态`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增雷达
            </Button>
          </>
        }
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: '搜索雷达名称…' }} />

      <DataTablePro<TechnologyRadar>
        columns={columns}
        dataSource={paged}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total: filtered.length,
          onChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="技术雷达加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无技术雷达"
              desc="新建雷达并定义象限、环与技术项。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreate}>
                  新增雷达
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title={viewRadar ? `技术雷达 · ${viewRadar.name}` : '技术雷达'}
        open={viewRadar !== null}
        onClose={() => setViewRadar(null)}
        footer={<Button onClick={() => setViewRadar(null)}>关闭</Button>}
      >
        {viewRadar ? (
          <>
            {viewQuadrants.length === 0 || viewRings.length === 0 ? (
              <EmptyState
                illustration="no-content"
                title="该雷达未定义象限或环"
                desc="编辑雷达并填入象限、环 JSON 后即可可视化。"
              />
            ) : (
              <svg width={RADAR_SIZE} height={RADAR_SIZE} role="img" aria-label={`${viewRadar.name} 技术雷达`}>
                {viewRings.map((_, i) => {
                  const r = RADAR_MAX_RADIUS - i * ringWidth;
                  return (
                    <circle
                      key={`ring-${i}`}
                      cx={RADAR_CENTER}
                      cy={RADAR_CENTER}
                      r={r}
                      fill="var(--semi-color-fill-0)"
                      stroke="var(--semi-color-border)"
                      strokeWidth={1}
                    />
                  );
                })}
                <line
                  x1={RADAR_CENTER}
                  y1={8}
                  x2={RADAR_CENTER}
                  y2={RADAR_SIZE - 8}
                  stroke="var(--semi-color-border)"
                  strokeWidth={1}
                />
                <line
                  x1={8}
                  y1={RADAR_CENTER}
                  x2={RADAR_SIZE - 8}
                  y2={RADAR_CENTER}
                  stroke="var(--semi-color-border)"
                  strokeWidth={1}
                />
                {viewQuadrants.map((q, i) => {
                  const x = i === 0 || i === 1 ? RADAR_SIZE - 8 : 8;
                  const y = i === 0 || i === 3 ? 20 : RADAR_SIZE - 10;
                  const anchor = i === 0 || i === 1 ? 'end' : 'start';
                  return (
                    <text
                      key={`quad-${i}`}
                      x={x}
                      y={y}
                      textAnchor={anchor}
                      fill={QUADRANT_TONES[i % QUADRANT_TONES.length]}
                      fontSize={13}
                      fontWeight={600}
                    >
                      {q}
                    </text>
                  );
                })}
                {viewRings.map((r, i) => (
                  <text
                    key={`ring-label-${i}`}
                    x={RADAR_CENTER + 6}
                    y={RADAR_CENTER - (RADAR_MAX_RADIUS - i * ringWidth - ringWidth / 2)}
                    fill="var(--semi-color-text-2)"
                    fontSize={11}
                  >
                    {r}
                  </text>
                ))}
                {(viewRadar.items ?? []).map((item) => {
                  const pos = positions.get(item.id);
                  if (!pos) return null;
                  const qi = viewQuadrants.indexOf(item.quadrant);
                  return (
                    <g key={item.id}>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={5}
                        fill={QUADRANT_TONES[(qi < 0 ? 0 : qi) % QUADRANT_TONES.length]}
                        stroke="var(--semi-color-bg-1)"
                        strokeWidth={2}
                      />
                      <text x={pos.x + 9} y={pos.y + 4} fill="var(--semi-color-text-1)" fontSize={11}>
                        {item.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            <div>
              <Typography.Text strong>技术项清单</Typography.Text>
              <DataTablePro<TechnologyRadarItem>
                columns={itemColumns}
                dataSource={viewRadar.items ?? []}
                rowKey="id"
                columnSettings={false}
                empty={<EmptyState illustration="no-content" title="该雷达暂无技术项" />}
              />
            </div>
          </>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={editing ? `编辑技术雷达 · ${editing.name}` : '新增技术雷达'}
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
        <Form form={form} labelPosition="left" labelWidth={110}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="2026 H2 技术雷达" />
          <Form.Select
            field="status"
            label="状态"
            initValue="active"
            optionList={[
              { value: 'active', label: '活跃' },
              { value: 'draft', label: '草稿' },
              { value: 'archived', label: '已归档' },
            ]}
          />
          <Form.TextArea
            field="quadrants"
            label="象限（JSON）"
            rules={[{ required: true, message: '请输入象限数组' }]}
            initValue="[]"
            rows={2}
            placeholder='["语言与框架","数据与存储","平台与基础设施","工具与流程"]'
          />
          <Form.TextArea
            field="rings"
            label="环（JSON）"
            rules={[{ required: true, message: '请输入环数组' }]}
            initValue="[]"
            rows={2}
            placeholder='["采纳","试用","评估","暂缓"]'
          />
          <Form.TextArea
            field="items"
            label="技术项（JSON）"
            rules={[{ required: true, message: '请输入技术项数组' }]}
            initValue="[]"
            rows={8}
            placeholder='[{"id":"1","name":"React","quadrant":"语言与框架","ring":"采纳","trend":"stable","description":"..."}]'
          />
        </Form>
      </SheetDetail>
    </>
  );
}
