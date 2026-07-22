import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { listRules, createRule, updateRule, deleteRule } from '@/api/permissions';
import { listTools } from '@/api/tools';
import { listServers } from '@/api/servers';
import { listResources } from '@/api/resources';
import { listPrompts } from '@/api/prompts';
import RuleEditor from '@/components/RuleEditor';
import type {
  PermissionRule,
  PermissionRuleCreateRequest,
  McpTool,
  McpServer,
  McpResource,
  PromptTemplate,
} from '@/types';

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
        message.success('已更新');
      } else {
        await createRule(values);
        message.success('已创建');
      }
      setEditorOpen(false);
      setEditing(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<PermissionRule> = [
    {
      title: '规则',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <SafetyOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
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
          <Tag>{r.subjectType}</Tag>
          {r.subject}
        </span>
      ),
    },
    {
      title: '资源',
      key: 'resource',
      render: (_, r) => (
        <span>
          <Tag color="blue">{r.resourceType}</Tag>
          {r.resourceId}
        </span>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      render: (v: string[]) => v.map((a) => <Tag color="purple" key={a}>{a}</Tag>),
    },
    {
      title: '效果',
      key: 'effect',
      render: (_, r) => (
        <Tag color={r.effect === 'allow' ? 'green' : 'red'}>{r.effect}</Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button
            type="link"
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
            message.success('已删除');
            load();
          }}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          权限规则
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          创建规则
        </Button>
      </div>

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
