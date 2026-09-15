import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { listRules, createRule, updateRule, deleteRule } from '@/api/mcphub/permissions';
import { listTools } from '@/api/mcphub/tools';
import { listServers } from '@/api/mcphub/servers';
import { listResources } from '@/api/mcphub/resources';
import { listPrompts } from '@/api/mcphub/prompts';
import RuleEditor from './components/RuleEditor';
import { PageHeader } from '@/components/skeleton';
import type {
  PermissionRule,
  PermissionRuleCreateRequest,
  McpTool,
  McpServer,
  McpResource,
  PromptTemplate,
} from '@/api/mcphub/types';

export default function PermissionRulePage() {
  const [rules, setRules] = useState<PermissionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resources, setResources] = useState<
    Array<{ type: PermissionRule['resourceType']; id: string; name: string }>
  >([]);

  const load = async () => {
    setLoading(true);
    try {
      const [r, toolsRes, serversRes, resourcesRes, promptsRes] = await Promise.all([
        listRules(),
        listTools(),
        listServers(),
        listResources(),
        listPrompts(),
      ]);
      setRules(r.items);
      const all: Array<{ type: PermissionRule['resourceType']; id: string; name: string }> = [];
      (toolsRes.items as McpTool[]).forEach((t) =>
        all.push({ type: 'tool', id: t.id, name: t.name }),
      );
      (serversRes.items as McpServer[]).forEach((s) =>
        all.push({ type: 'server', id: s.id, name: s.name }),
      );
      (resourcesRes.items as McpResource[]).forEach((r2) =>
        all.push({ type: 'resource', id: r2.id, name: r2.name }),
      );
      (promptsRes.items as PromptTemplate[]).forEach((p) =>
        all.push({ type: 'prompt', id: p.id, name: p.name }),
      );
      setResources(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (values: PermissionRuleCreateRequest) => {
    setSubmitting(true);
    try {
      if (editing) {
        await updateRule(editing.id, values);
        Toast.success('已更新');
      } else {
        await createRule(values);
        Toast.success('已创建');
      }
      setEditorOpen(false);
      setEditing(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnProps<PermissionRule>[] = [
    {
      title: '规则',
      key: 'name',
      render: (_, r) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <SafetyOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="tertiary" className="mp-text-sm">
            优先级 {r.priority}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '主体',
      key: 'subject',
      render: (_, r) => (
        <span>
          <Tag size="small">{r.subjectType}</Tag>
          {r.subject}
        </span>
      ),
    },
    {
      title: '资源',
      key: 'resource',
      render: (_, r) => (
        <span>
          <Tag size="small" color="blue">{r.resourceType}</Tag>
          {r.resourceId}
        </span>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      render: (v: string[]) => v.map((a) => <Tag size="small" color="purple" key={a}>{a}</Tag>),
    },
    {
      title: '效果',
      key: 'effect',
      render: (_, r) => (
        <Tag size="small" color={r.effect === 'allow' ? 'green' : 'red'}>{r.effect}</Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag size="small" color="green">是</Tag> : <Tag size="small">否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            theme="borderless"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(r);
              setEditorOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={async () => {
            await deleteRule(r.id);
            Toast.success('已删除');
            load();
          }}>
            <Button size="small" theme="borderless" type="danger" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="权限规则"
        actions={
          <Button
                  theme="solid"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditing(null);
                    setEditorOpen(true);
                  }}
                >
                  创建规则
                </Button>
        }
      />

      <Card>
        {rules.length === 0 && !loading ? (
          <Empty description="还没有权限规则" />
        ) : (
          <Table
            rowKey="id"
            dataSource={rules}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <RuleEditor
        open={editorOpen}
        initial={editing}
        resources={resources}
        onOk={handleSubmit}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        confirmLoading={submitting}
      />
    </div>
  );
}
