import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import {
  DownloadOutlined,
  ReloadOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { getPolicyMatrix, exportPolicyMatrix, createPolicy } from '@/api/mcphub/policies';
import type {
  MatrixCellEffect,
  PolicyCreateRequest,
  PolicyMatrix,
  PolicyMatrixColumn,
  PolicyMatrixRow,
} from '@/api/mcphub/types';

const ACTION_OPTIONS = [
  { label: '调用 (invoke)', value: 'invoke' },
  { label: '读取 (read)', value: 'read' },
  { label: '管理 (admin)', value: 'admin' },
];

const MATRIX_TYPE_OPTIONS = [
  { label: '用户 × 工具', key: 'user-tool' },
  { label: '应用 × 工具', key: 'app-tool' },
];

const EFFECT_OPTIONS = [
  { label: '允许', value: 'ALLOW' },
  { label: '拒绝', value: 'DENY' },
];

interface EditCell {
  subjectId: string;
  subjectName: string;
  subjectType: 'USER' | 'APP';
  toolId: string;
  toolName: string;
  currentEffect: MatrixCellEffect;
}

export default function PermissionMatrixPage() {
  const [matrixType, setMatrixType] = useState<'user-tool' | 'app-tool'>('user-tool');
  const [action, setAction] = useState('invoke');
  const [matrix, setMatrix] = useState<PolicyMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<EditCell | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{ effect: 'ALLOW' | 'DENY' }>();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPolicyMatrix(matrixType, action);
      setMatrix(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [matrixType, action]);

  const toolNames = useMemo(() => {
    const map = new Map<string, string>();
    matrix?.columns.forEach((col) => {
      map.set(col.toolId, col.toolName || col.toolCode || col.toolId);
    });
    return map;
  }, [matrix]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const blob = await exportPolicyMatrix(matrixType, format, action);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `policy-matrix-${matrixType}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      Toast.success('导出成功');
    } finally {
      setExporting(false);
    }
  };

  const openEditCell = (row: PolicyMatrixRow, col: PolicyMatrixColumn) => {
    setEditing({
      subjectId: row.subject.subjectId,
      subjectName: row.subject.subjectName,
      subjectType: row.subject.subjectType,
      toolId: col.toolId,
      toolName: toolNames.get(col.toolId) || col.toolId,
      currentEffect: row.cells[col.toolId] || 'inherit',
    });
    // Semi 的 Form.useForm 在 Form 组件挂载前调用方法无效（警告且不生效），
    // 改为 Modal 内 Form.RadioGroup 的 initValue 声明式初始化，行为等价（每次打开都按 currentEffect 预填）。
  };

  const handleCellSubmit = async (values: { effect: 'ALLOW' | 'DENY' }) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      const payload: PolicyCreateRequest = {
        name: `${editing.subjectName} -> ${editing.toolName} (${action})`,
        subjectType: editing.subjectType,
        subjectId: editing.subjectId,
        resourceType: 'tool',
        resourceIds: [editing.toolId],
        action,
        effect: values.effect,
        priority: 100,
        enabled: true,
      };
      await createPolicy(payload);
      Toast.success('策略已更新');
      setEditing(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<ColumnProps<PolicyMatrixRow>[]>(() => {
    const base: ColumnProps<PolicyMatrixRow>[] = [
      {
        title: matrixType === 'user-tool' ? '用户' : '应用',
        dataIndex: 'subject.subjectName',
        fixed: 'left',
        width: 160,
        render: (_, r) => (
          <Space>
            <SafetyOutlined />
            <Typography.Text strong>{r.subject.subjectName}</Typography.Text>
            <Tag>{r.subject.subjectType === 'USER' ? '用户' : '应用'}</Tag>
          </Space>
        ),
      },
    ];
    matrix?.columns.forEach((col) => {
      const toolName = toolNames.get(col.toolId) || col.toolId;
      base.push({
        title: (
          <span title={toolName}>
            <Typography.Text ellipsis style={{ maxWidth: 120 }}>
              {toolName}
            </Typography.Text>
          </span>
        ),
        dataIndex: `cells.${col.toolId}`,
        align: 'center',
        width: 100,
        render: (effect: MatrixCellEffect | undefined, row) => {
          const cellEffect = effect || 'inherit';
          const color = cellEffect === 'allow' ? 'green' : cellEffect === 'deny' ? 'red' : 'grey';
          const label = cellEffect === 'allow' ? '允许' : cellEffect === 'deny' ? '拒绝' : '继承';
          return (
            <Tag
              color={color}
              style={{ cursor: 'pointer', minWidth: 56, textAlign: 'center' }}
              onClick={() => openEditCell(row, col)}
            >
              {label}
            </Tag>
          );
        },
      });
    });
    return base;
  }, [matrix, matrixType, toolNames]);

  return (
    <div>
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          权限矩阵
        </Typography.Title>
        <Space>
          <Select
            value={action}
            optionList={ACTION_OPTIONS}
            onChange={(v) => setAction(v as string)}
            style={{ width: 160 }}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => handleExport('csv')}>
            导出 CSV
          </Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => handleExport('xlsx')}>
            导出 Excel
          </Button>
        </Space>
      </div>

      <Card>
        <Tabs
          activeKey={matrixType}
          onChange={(k) => setMatrixType(k as 'user-tool' | 'app-tool')}
          tabList={MATRIX_TYPE_OPTIONS.map((t) => ({ itemKey: t.key, tab: t.label }))}
          style={{ marginBottom: 16 }}
        />

        {matrix && matrix.rows.length === 0 && !loading ? (
          <Empty description="暂无权限矩阵数据" />
        ) : (
          <Table
            rowKey={(r) => r?.subject.subjectId ?? ''}
            dataSource={matrix?.rows || []}
            columns={columns}
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={false}
            size="small"
            bordered
          />
        )}
      </Card>

      <Modal
        title="编辑矩阵单元格"
        visible={!!editing}
        confirmLoading={submitting}
        onCancel={() => setEditing(null)}
        onOk={() => form.submitForm()}
      >
        {editing && (
          <Form form={form} layout="vertical" onSubmit={handleCellSubmit}>
            <Typography.Paragraph>
              主体：<Typography.Text strong>{editing.subjectName}</Typography.Text>
              <br />
              工具：<Typography.Text strong>{editing.toolName}</Typography.Text>
              <br />
              操作：<Tag>{action}</Tag>
              <br />
              当前效果：
              <Tag
                color={
                  editing.currentEffect === 'allow'
                    ? 'green'
                    : editing.currentEffect === 'deny'
                    ? 'red'
                    : 'grey'
                }
              >
                {editing.currentEffect === 'allow'
                  ? '允许'
                  : editing.currentEffect === 'deny'
                  ? '拒绝'
                  : '继承'}
              </Tag>
            </Typography.Paragraph>

            <Form.RadioGroup
              field="effect"
              label="新策略效果"
              rules={[{ required: true, message: '请选择策略效果' }]}
              options={EFFECT_OPTIONS}
              initValue={editing.currentEffect === 'deny' ? 'DENY' : 'ALLOW'}
            />
          </Form>
        )}
      </Modal>
    </div>
  );
}
