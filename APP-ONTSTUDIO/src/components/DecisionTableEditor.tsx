import { useState } from 'react';
import {
  Button,
  Card,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type {
  DecisionTable,
  DecisionTableColumn,
  DecisionTableRow,
  DecisionTableCell,
  DecisionTableColumnType,
  DecisionTableOperator,
} from '@/types';
import { HIT_POLICY_OPTIONS } from '@/api/decision-tables';

interface DecisionTableEditorProps {
  table: DecisionTable;
  onChange: (table: DecisionTable) => void;
  onExecute?: (input: Record<string, unknown>) => void;
}

const OPERATOR_OPTIONS: Array<{ label: string; value: DecisionTableOperator }> = [
  { label: '等于 =', value: 'eq' },
  { label: '不等于 ≠', value: 'ne' },
  { label: '大于 >', value: 'gt' },
  { label: '小于 <', value: 'lt' },
  { label: '大于等于 ≥', value: 'gte' },
  { label: '小于等于 ≤', value: 'lte' },
  { label: '包含于 (in)', value: 'in' },
  { label: '字符串包含', value: 'contains' },
  { label: '区间 (between)', value: 'between' },
];

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function defaultCell(): DecisionTableCell {
  return { value: '-', isEmpty: true };
}

export default function DecisionTableEditor({
  table,
  onChange,
  onExecute,
}: DecisionTableEditorProps) {
  const [execOpen, setExecOpen] = useState(false);
  const [execInput, setExecInput] = useState('{\n  \n}');

  const update = (patch: Partial<DecisionTable>) => {
    onChange({ ...table, ...patch, updatedAt: new Date().toISOString() });
  };

  // ============ 列操作 ============
  const addColumn = (columnType: DecisionTableColumnType) => {
    const col: DecisionTableColumn = {
      id: newId('col'),
      name: columnType === 'input' ? '新输入列' : '新输出列',
      field: '',
      columnType,
      ...(columnType === 'input' ? { operator: 'eq' as DecisionTableOperator } : {}),
    };
    const newRows = table.rows.map((r) => ({
      ...r,
      cells: { ...r.cells, [col.id]: defaultCell() },
    }));
    update({ columns: [...table.columns, col], rows: newRows });
  };

  const updateColumn = (colId: string, patch: Partial<DecisionTableColumn>) => {
    update({
      columns: table.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)),
    });
  };

  const removeColumn = (colId: string) => {
    update({
      columns: table.columns.filter((c) => c.id !== colId),
      rows: table.rows.map((r) => {
        const next = { ...r.cells };
        delete next[colId];
        return { ...r, cells: next };
      }),
    });
  };

  // ============ 行操作 ============
  const addRow = () => {
    const cells: Record<string, DecisionTableCell> = {};
    table.columns.forEach((c) => {
      cells[c.id] = defaultCell();
    });
    const row: DecisionTableRow = {
      id: newId('row'),
      cells,
      enabled: true,
      priority: table.rows.length + 1,
      description: '',
    };
    update({ rows: [...table.rows, row] });
  };

  const updateRow = (rowId: string, patch: Partial<DecisionTableRow>) => {
    update({
      rows: table.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    });
  };

  const removeRow = (rowId: string) => {
    update({ rows: table.rows.filter((r) => r.id !== rowId) });
  };

  // ============ 单元格操作 ============
  const updateCell = (rowId: string, colId: string, value: string) => {
    const isEmpty = value === '-' || value === '';
    update({
      rows: table.rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              cells: {
                ...r.cells,
                [colId]: { value: isEmpty ? '-' : value, isEmpty },
              },
            }
          : r,
      ),
    });
  };

  // ============ 执行测试 ============
  const handleExecConfirm = () => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(execInput);
    } catch {
      message.warning('请输入合法 JSON');
      return;
    }
    setExecOpen(false);
    onExecute?.(parsed);
  };

  // ============ 构造表格列 ============
  const inputColumns = table.columns.filter((c) => c.columnType === 'input');
  const outputColumns = table.columns.filter((c) => c.columnType === 'output');

  const buildColumnDef = (col: DecisionTableColumn): ColumnsType<DecisionTableRow>[number] => ({
    title: (
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        <Space size={4}>
          <Tag color={col.columnType === 'input' ? 'blue' : 'green'}>
            {col.columnType === 'input' ? '输入' : '输出'}
          </Tag>
          <Input
            size="small"
            value={col.name}
            onChange={(e) => updateColumn(col.id, { name: e.target.value })}
            placeholder="列名"
            style={{ width: 100 }}
            variant="borderless"
          />
          <Tooltip title="删除该列">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeColumn(col.id)}
            />
          </Tooltip>
        </Space>
        <Space size={4}>
          <Input
            size="small"
            value={col.field}
            onChange={(e) => updateColumn(col.id, { field: e.target.value })}
            placeholder="字段名"
            style={{ width: 100 }}
          />
          {col.columnType === 'input' ? (
            <Select
              size="small"
              value={col.operator ?? 'eq'}
              onChange={(v) => updateColumn(col.id, { operator: v })}
              style={{ width: 110 }}
              options={OPERATOR_OPTIONS}
            />
          ) : (
            <Input
              size="small"
              value={col.defaultValue ?? ''}
              onChange={(e) => updateColumn(col.id, { defaultValue: e.target.value })}
              placeholder="默认值"
              style={{ width: 110 }}
            />
          )}
        </Space>
      </Space>
    ),
    dataIndex: ['cells', col.id],
    width: 220,
    render: (_, row) => (
      <Input
        size="small"
        value={row.cells[col.id]?.isEmpty ? '-' : row.cells[col.id]?.value ?? ''}
        onChange={(e) => updateCell(row.id, col.id, e.target.value)}
        placeholder="输入值，- 表示任意"
        variant={row.cells[col.id]?.isEmpty ? 'borderless' : 'outlined'}
        style={{
          fontStyle: row.cells[col.id]?.isEmpty ? 'italic' : 'normal',
          color: row.cells[col.id]?.isEmpty ? '#999' : 'inherit',
          backgroundColor:
            col.columnType === 'input' ? 'rgba(24,144,255,0.04)' : 'rgba(82,196,26,0.04)',
        }}
      />
    ),
  });

  const columns: ColumnsType<DecisionTableRow> = [
    {
      title: '#',
      key: 'index',
      width: 60,
      render: (_, r, idx) => (
        <Space direction="vertical" size={2} align="center">
          <Typography.Text type="secondary">{idx + 1}</Typography.Text>
          <Switch
            size="small"
            checked={r.enabled}
            onChange={(v) => updateRow(r.id, { enabled: v })}
          />
        </Space>
      ),
    },
    {
      title: '优先级',
      key: 'priority',
      width: 80,
      render: (_, r) => (
        <InputNumber
          size="small"
          value={r.priority}
          onChange={(v) => updateRow(r.id, { priority: typeof v === 'number' ? v : 0 })}
          style={{ width: 60 }}
        />
      ),
    },
    ...inputColumns.map((c) => buildColumnDef(c)),
    ...outputColumns.map((c) => buildColumnDef(c)),
    {
      title: '描述',
      key: 'description',
      width: 200,
      render: (_, r) => (
        <Input
          size="small"
          value={r.description ?? ''}
          onChange={(e) => updateRow(r.id, { description: e.target.value })}
          placeholder="规则说明"
        />
      ),
    },
    {
      title: '操作',
      key: 'ops',
      width: 80,
      fixed: 'right',
      render: (_, r) => (
        <Popconfirm title="删除该规则行？" onConfirm={() => removeRow(r.id)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const renderColumnHeaderNote = () => (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      共 {inputColumns.length} 个输入列、{outputColumns.length} 个输出列；表格中
      <Tag color="blue" style={{ marginLeft: 4 }}>输入</Tag>
      与
      <Tag color="green" style={{ marginLeft: 4 }}>输出</Tag>
      按颜色区分；单元格输入 <code>-</code> 表示任意值（匹配所有）。
    </Typography.Text>
  );

  return (
    <Card
      size="small"
      title={
        <Space>
          <ThunderboltOutlined />
          <Typography.Text strong>决策表编辑器</Typography.Text>
          <Tag color="purple">{table.code}</Tag>
        </Space>
      }
      extra={
        <Space>
          <span>命中策略：</span>
          <Select
            value={table.hitPolicy}
            onChange={(v) => update({ hitPolicy: v })}
            style={{ width: 140 }}
            options={HIT_POLICY_OPTIONS.map((o) => ({
              label: o.label,
              value: o.value,
              title: o.description,
            }))}
          />
          <Button icon={<PlusOutlined />} onClick={() => addColumn('input')}>
            添加输入列
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => addColumn('output')}>
            添加输出列
          </Button>
          <Button icon={<PlusOutlined />} onClick={addRow}>
            添加规则行
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => setExecOpen(true)}
          >
            执行测试
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {renderColumnHeaderNote()}
        <Table<DecisionTableRow>
          rowKey="id"
          dataSource={table.rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="small"
          bordered
        />
        {table.rows.length === 0 && (
          <Typography.Text type="secondary">
            暂无规则行，点击「添加规则行」开始配置。
          </Typography.Text>
        )}
      </Space>

      <Modal
        title="执行决策表"
        open={execOpen}
        onCancel={() => setExecOpen(false)}
        onOk={handleExecConfirm}
        okText="执行"
        width={640}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Typography.Text type="secondary">
            请输入测试输入数据（JSON），字段需匹配输入列的 field：
            {inputColumns.map((c) => c.field).filter(Boolean).join(', ')}
          </Typography.Text>
          <Input.TextArea
            rows={10}
            value={execInput}
            onChange={(e) => setExecInput(e.target.value)}
            style={{ fontFamily: 'Menlo, Consolas, monospace' }}
          />
        </Space>
      </Modal>
    </Card>
  );
}
