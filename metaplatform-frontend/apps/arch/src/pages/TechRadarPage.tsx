import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Space, Typography, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listTechnologyRadars, createTechnologyRadar, updateTechnologyRadar, deleteTechnologyRadar } from '@/api/technologyRadar';
import type { TechnologyRadar, TechnologyRadarItem } from '@/types';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '活跃' },
  draft: { color: 'blue', label: '草稿' },
  archived: { color: 'default', label: '已归档' },
};

const TREND_MAP: Record<string, { color: string; label: string }> = {
  up: { color: 'green', label: '上升' },
  down: { color: 'red', label: '下降' },
  stable: { color: 'default', label: '平稳' },
};

const DEFAULT_QUADRANTS = ['语言与框架', '数据与存储', '平台与基础设施', '工具与流程'];
const DEFAULT_RINGS = ['采纳', '试用', '评估', '暂缓'];
const QUADRANT_COLORS = ['#1677ff', '#52c41a', '#722ed1', '#fa8c16'];
const RING_COLORS = ['#d9f7be', '#fff1b8', '#ffd8bf', '#ffccc7'];

function useRadarGeometry(radar: TechnologyRadar | null) {
  return useMemo(() => {
    const quadrants = radar?.quadrants?.length ? radar.quadrants : DEFAULT_QUADRANTS;
    const rings = radar?.rings?.length ? radar.rings : DEFAULT_RINGS;
    const size = 520;
    const center = size / 2;
    const maxRadius = size / 2 - 32;
    const ringWidth = maxRadius / rings.length;
    return { size, center, maxRadius, ringWidth, quadrants, rings };
  }, [radar]);
}

function computeItemPositions(items: TechnologyRadarItem[], quadrants: string[], rings: string[]) {
  const buckets = new Map<string, TechnologyRadarItem[]>();
  items.forEach((item) => {
    const key = `${item.quadrant}-${item.ring}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  });

  const positions = new Map<string, { x: number; y: number }>();
  buckets.forEach((bucket, key) => {
    const [quadName, ringName] = key.split('-');
    const qi = quadrants.indexOf(quadName);
    const ri = rings.indexOf(ringName);
    if (qi < 0 || ri < 0) return;

    const quadrantStartAngle = qi * 90;
    const innerRadius = ri * (200 / rings.length);
    const outerRadius = (ri + 1) * (200 / rings.length);
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
      positions.set(item.id, {
        x: 260 + radius * Math.cos(rad),
        y: 260 + radius * Math.sin(rad),
      });
    });
  });
  return positions;
}

export default function TechRadarPage() {
  const [radars, setRadars] = useState<TechnologyRadar[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TechnologyRadar | null>(null);
  const [selectedRadar, setSelectedRadar] = useState<TechnologyRadar | null>(null);
  const [form] = Form.useForm<Partial<TechnologyRadar>>();

  const load = async () => {
    setLoading(true);
    const data = await listTechnologyRadars();
    setRadars(data);
    if (data.length > 0 && !selectedRadar) setSelectedRadar(data[0]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const { size, center, maxRadius, ringWidth, quadrants, rings } = useRadarGeometry(selectedRadar);
  const positions = useMemo(
    () => computeItemPositions(selectedRadar?.items ?? [], quadrants, rings),
    [selectedRadar, quadrants, rings]
  );

  const parseJson = (text: string): unknown => {
    try {
      return JSON.parse(text || '[]');
    } catch {
      return [];
    }
  };

  const stringifyJson = (value: unknown) => JSON.stringify(value ?? [], null, 2);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      quadrants: parseJson(values.quadrants as unknown as string) as string[],
      rings: parseJson(values.rings as unknown as string) as string[],
      items: parseJson(values.items as unknown as string) as TechnologyRadarItem[],
    };
    if (editing) {
      await updateTechnologyRadar(editing.id, payload);
      message.success('更新成功');
    } else {
      await createTechnologyRadar(payload);
      message.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  const handleEdit = (record: TechnologyRadar) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      quadrants: stringifyJson(record.quadrants),
      rings: stringifyJson(record.rings),
      items: stringifyJson(record.items),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTechnologyRadar(id);
    message.success('已删除');
    if (selectedRadar?.id === id) setSelectedRadar(null);
    load();
  };

  const radarColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '象限数', key: 'quadrantCount', render: (_: unknown, r: TechnologyRadar) => r.quadrants?.length ?? 0 },
    { title: '环数', key: 'ringCount', render: (_: unknown, r: TechnologyRadar) => r.rings?.length ?? 0 },
    { title: '项目数', key: 'itemCount', render: (_: unknown, r: TechnologyRadar) => r.items?.length ?? 0 },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: TechnologyRadar) => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
        <Button type="link" size="small" onClick={() => setSelectedRadar(r)}>查看雷达</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const itemColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '象限', dataIndex: 'quadrant', key: 'quadrant' },
    { title: '环', dataIndex: 'ring', key: 'ring' },
    { title: '趋势', dataIndex: 'trend', key: 'trend', render: (t?: string) => t ? <Tag color={TREND_MAP[t]?.color}>{TREND_MAP[t]?.label ?? t}</Tag> : '-' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  return (
    <div>
      <Typography.Title level={4}>技术雷达</Typography.Title>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增雷达</Button>
        </Space>
        <Table rowKey="id" columns={radarColumns} dataSource={radars} loading={loading} size="small" pagination={false} scroll={{ x: 'max-content' }} />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={14}>
          <Card title={selectedRadar ? `技术雷达：${selectedRadar.name}` : '技术雷达视图'}>
            <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
              {rings.map((_, i) => {
                const r = maxRadius - i * ringWidth;
                return (
                  <circle
                    key={`ring-${i}`}
                    cx={center}
                    cy={center}
                    r={r}
                    fill={RING_COLORS[i % RING_COLORS.length]}
                    stroke="#d9d9d9"
                    strokeWidth={1}
                  />
                );
              })}
              <line x1={center} y1={16} x2={center} y2={size - 16} stroke="#8c8c8c" strokeWidth={1} />
              <line x1={16} y1={center} x2={size - 16} y2={center} stroke="#8c8c8c" strokeWidth={1} />
              {quadrants.map((q, i) => {
                const x = i === 0 || i === 1 ? size - 16 : 16;
                const y = i === 0 || i === 3 ? 24 : size - 16;
                const anchor = i === 0 || i === 1 ? 'end' : 'start';
                return (
                  <text key={`quad-label-${i}`} x={x} y={y} textAnchor={anchor} fill={QUADRANT_COLORS[i % QUADRANT_COLORS.length]} fontSize={14} fontWeight={600}>
                    {q}
                  </text>
                );
              })}
              {rings.map((r, i) => (
                <text key={`ring-label-${i}`} x={center + 8} y={center - (maxRadius - i * ringWidth - ringWidth / 2)} fill="#595959" fontSize={11}>
                  {r}
                </text>
              ))}
              {selectedRadar?.items?.map((item) => {
                const pos = positions.get(item.id);
                if (!pos) return null;
                const qi = quadrants.indexOf(item.quadrant);
                return (
                  <g key={item.id}>
                    <circle cx={pos.x} cy={pos.y} r={6} fill={QUADRANT_COLORS[qi % QUADRANT_COLORS.length]} stroke="#fff" strokeWidth={2} />
                    <text x={pos.x + 10} y={pos.y + 4} fill="#262626" fontSize={11}>
                      {item.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </Card>
        </Col>
        <Col span={10}>
          <Card title="技术项清单">
            <Table
              rowKey="id"
              columns={itemColumns}
              dataSource={selectedRadar?.items ?? []}
              size="small"
              pagination={false}
              scroll={{ y: 360 }}
            />
          </Card>
        </Col>
      </Row>

      <Modal title={editing ? '编辑技术雷达' : '新增技术雷达'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select options={[
              { value: 'active', label: '活跃' },
              { value: 'draft', label: '草稿' },
              { value: 'archived', label: '已归档' },
            ]} />
          </Form.Item>
          <Form.Item name="quadrants" label="象限（JSON 数组）" rules={[{ required: true }]} initialValue={stringifyJson(DEFAULT_QUADRANTS)}>
            <Input.TextArea rows={2} placeholder='["语言与框架","数据与存储","平台与基础设施","工具与流程"]' />
          </Form.Item>
          <Form.Item name="rings" label="环（JSON 数组）" rules={[{ required: true }]} initialValue={stringifyJson(DEFAULT_RINGS)}>
            <Input.TextArea rows={2} placeholder='["采纳","试用","评估","暂缓"]' />
          </Form.Item>
          <Form.Item name="items" label="技术项（JSON 数组）" rules={[{ required: true }]} initialValue="[]">
            <Input.TextArea rows={8} placeholder='[{"id":"1","name":"React","quadrant":"语言与框架","ring":"采纳","trend":"stable","description":"..."}]' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
