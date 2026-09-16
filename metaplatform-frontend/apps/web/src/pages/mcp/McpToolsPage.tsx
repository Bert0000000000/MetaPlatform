import { useEffect, useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Select,
  Space,
  Tag,
  Toast,
  Typography,
  Popconfirm,
  Switch,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CodeOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { listTools, listCategories, deleteTool, updateTool } from '@/api/mcphub/tools';
import ToolCategoryTree from './components/ToolCategoryTree';
import ToolDrawer from './components/ToolDrawer';
import CategoryManagementModal from './components/CategoryManagementModal';
import type { McpTool, McpToolCategory } from '@/api/mcphub/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import './mcp.css';

const TOOLS_PATH = '/ki/mcp/tools';
const PAGE_SIZE = 10;

export default function ToolListPage() {
  const navigate = useNavigate();
  const [tools, setTools] = useState<McpTool[]>([]);
  const [categories, setCategories] = useState<McpToolCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>();
  const [page, setPage] = useState(1);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // 表单抽屉由路由驱动：/tools/new 与 /tools/:id/edit 都渲染本列表页，只有抽屉是开的。
  // 这样深链可分享、浏览器后退能直接关掉抽屉，页面上的按钮也不必改成 setState 调用。
  const createMatch = useMatch(`${TOOLS_PATH}/new`);
  const editMatch = useMatch(`${TOOLS_PATH}/:id/edit`);
  const editingId = createMatch ? null : (editMatch?.params.id ?? null);
  const drawerOpen = !!createMatch || editingId !== null;

  const load = async () => {
    setLoading(true);
    try {
      const res = await listTools();
      setTools(res.items);
      setCategories(await listCategories());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 工具侧的分类字段是列表页唯一可靠的分类来源（/tool-categories 目前可能为空），
  // 与「分类管理」登记的集合取并集后给筛选下拉用。
  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    for (const t of tools) if (t.category) names.add(t.category);
    for (const c of categories) if (c.code) names.add(c.code);
    return [...names].sort();
  }, [tools, categories]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return tools.filter((t) => {
      const hit = !kw || t.name.toLowerCase().includes(kw) || (t.code ?? '').toLowerCase().includes(kw);
      return hit && (!category || t.category === category);
    });
  }, [tools, keyword, category]);

  useEffect(() => {
    setPage(1);
  }, [keyword, category]);

  const paged = useMemo(
    () => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visible, page],
  );

  const handleDelete = async (tool: McpTool) => {
    await deleteTool(tool.id);
    Toast.success('工具已删除');
    load();
  };

  const handleToggle = async (tool: McpTool, enabled: boolean) => {
    await updateTool(tool.id, {
      name: tool.name,
      code: tool.code,
      category: tool.category,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputType: tool.outputType,
      enabled,
      tags: tool.tags,
    });
    Toast.success(enabled ? '已启用' : '已停用');
    load();
  };

  const columns: ColumnProps<McpTool>[] = [
    {
      title: '工具',
      key: 'name',
      render: (_, t) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>{t.name}</Typography.Text>
          <Typography.Text type="tertiary" className="mp-text-sm">
            <CodeOutlined /> {t.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 140,
      render: (v) => <Tag size="small" color="blue">{v}</Tag>,
    },
    {
      title: '参数',
      key: 'params',
      width: 90,
      render: (_, t) => `${t.inputSchema.length} 个`,
    },
    {
      title: '输出类型',
      dataIndex: 'outputType',
      width: 110,
      render: (v) => <Tag size="small">{v}</Tag>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 90,
      render: (v) => <Tag size="small" color="purple">v{v}</Tag>,
    },
    {
      title: '启用',
      key: 'enabled',
      width: 90,
      render: (_, t) => <Switch checked={t.enabled} onChange={(v) => handleToggle(t, v)} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, t) => (
        <Space>
          <Button
            size="small"
            theme="borderless"
            icon={<EditOutlined />}
            onClick={() => navigate(`${TOOLS_PATH}/${t.id}`)}
          >
            详情
          </Button>
          <Button
            size="small"
            theme="borderless"
            icon={<EditOutlined />}
            onClick={() => navigate(`${TOOLS_PATH}/${t.id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(t)}>
            <Button size="small" type="danger" theme="borderless" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="工具注册中心"
        desc={`${tools.length} 个工具 · ${categoryOptions.length} 个分类`}
        actions={
          <Space>
            <Button icon={<FolderOutlined />} onClick={() => setCategoryModalOpen(true)}>
              分类管理
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(`${TOOLS_PATH}/new`)}
            >
              创建工具
            </Button>
          </Space>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索工具名称/编码…' }}
        filters={
          <Select
            placeholder="全部分类"
            showClear
            className="mp-w-160"
            value={category}
            onChange={(v) => setCategory(v as string | undefined)}
            optionList={categoryOptions.map((c) => ({ label: c, value: c }))}
          />
        }
      />

      <div className="mp-gap-4 mp-grid mp-mcp-grid-260">
        <Card title="按分类浏览" bodyStyle={{ padding: 8 }}>
          {tools.length === 0 ? (
            <EmptyState illustration="no-content" title="暂无工具" />
          ) : (
            <ToolCategoryTree tools={visible} onSelect={(id) => navigate(`${TOOLS_PATH}/${id}`)} />
          )}
        </Card>

        {!loading && visible.length === 0 ? (
          <EmptyState
            illustration={tools.length === 0 ? 'no-content' : 'no-result'}
            title={tools.length === 0 ? '还没有工具' : '没有匹配的工具'}
            desc={tools.length === 0 ? '注册一个工具，让数字员工可以调用它。' : '调整关键词或分类。'}
            actions={
              tools.length === 0 ? (
                <Button
                  theme="solid"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate(`${TOOLS_PATH}/new`)}
                >
                  创建工具
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTablePro<McpTool>
            rowKey="id"
            dataSource={paged}
            columns={columns}
            loading={loading}
            pagination={{
              currentPage: page,
              pageSize: PAGE_SIZE,
              total: visible.length,
              onChange: setPage,
            }}
          />
        )}
      </div>

      <ToolDrawer
        open={drawerOpen}
        toolId={editingId}
        onClose={() => navigate(TOOLS_PATH)}
        onSaved={load}
      />

      <CategoryManagementModal
        open={categoryModalOpen}
        onCancel={() => setCategoryModalOpen(false)}
      />
    </div>
  );
}
