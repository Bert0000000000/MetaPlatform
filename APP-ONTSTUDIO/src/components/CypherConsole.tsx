import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  SaveOutlined,
  SnippetsOutlined,
  DeleteOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import {
  executeCypher,
  listCypherTemplates,
  createCypherTemplate,
  updateCypherTemplate,
  deleteCypherTemplate,
  listCypherCategories,
} from '@/api/cypher';
import type {
  CypherExecuteResponse,
  CypherTemplate,
  CypherTemplateCategory,
  CypherTemplatePayload,
} from '@/api/cypher';

const { Text, Paragraph } = Typography;

const CATEGORY_LABELS: Record<CypherTemplateCategory, string> = {
  concept: '概念查询',
  relation: '关系查询',
  path: '路径查询',
  aggregate: '聚合查询',
};

const CATEGORY_COLORS: Record<CypherTemplateCategory, string> = {
  concept: 'blue',
  relation: 'green',
  path: 'orange',
  aggregate: 'purple',
};

const ALL_CATEGORIES: CypherTemplateCategory[] = ['concept', 'relation', 'path', 'aggregate'];

const DEFAULT_QUERY = 'MATCH (n:Concept) RETURN n.name AS name, n.code AS code LIMIT 50';

export default function CypherConsole() {
  const [query, setQuery] = useState<string>(DEFAULT_QUERY);
  const [executing, setExecuting] = useState(false);
  const [execution, setExecution] = useState<CypherExecuteResponse | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<CypherTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>(ALL_CATEGORIES);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<CypherTemplateCategory | undefined>(undefined);
  const [keyword, setKeyword] = useState('');

  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CypherTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<CypherTemplateCategory>('concept');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  // -------- 模板列表加载 --------

  const refreshTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const [items, cats] = await Promise.all([
        listCypherTemplates(filterCategory, keyword || undefined),
        listCypherCategories(),
      ]);
      setTemplates(items);
      const mergedCats = Array.from(new Set([...ALL_CATEGORIES, ...cats]));
      setCategories(mergedCats);
    } catch {
      // axios interceptor 已弹出错误提示
    } finally {
      setTemplatesLoading(false);
    }
  }, [filterCategory, keyword]);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  // -------- 执行 --------

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    setExecution(null);
    setExecutionError(null);
    try {
      const result = await executeCypher({ query });
      setExecution(result);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : '查询执行失败');
    } finally {
      setExecuting(false);
    }
  }, [query]);

  // -------- 模板加载 --------

  const handleLoadTemplate = useCallback((tpl: CypherTemplate) => {
    setQuery(tpl.query);
    message.success(`已加载模板：${tpl.name}`);
  }, []);

  // -------- 保存 / 编辑 --------

  const openCreateModal = useCallback(() => {
    setEditingTemplate(null);
    setFormName('');
    setFormCategory('concept');
    setFormDescription('');
    setFormTags([]);
    setTagsInput('');
    setEditorModalOpen(true);
  }, []);

  const openEditModal = useCallback((tpl: CypherTemplate) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormCategory(tpl.category);
    setFormDescription(tpl.description ?? '');
    setFormTags(tpl.tags ?? []);
    setTagsInput('');
    setEditorModalOpen(true);
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    if (!formName.trim()) {
      message.warning('请输入模板名称');
      return;
    }
    const payload: CypherTemplatePayload = {
      name: formName.trim(),
      category: formCategory,
      description: formDescription.trim() || undefined,
      query,
      tags: formTags.length > 0 ? formTags : undefined,
    };
    setSaving(true);
    try {
      if (editingTemplate) {
        await updateCypherTemplate(editingTemplate.templateId, payload);
        message.success('模板已更新');
      } else {
        await createCypherTemplate(payload);
        message.success('模板已保存');
      }
      setEditorModalOpen(false);
      await refreshTemplates();
    } catch {
      // axios interceptor 已提示
    } finally {
      setSaving(false);
    }
  }, [formName, formCategory, formDescription, formTags, query, editingTemplate, refreshTemplates]);

  const handleDeleteTemplate = useCallback(async (tpl: CypherTemplate) => {
    Modal.confirm({
      title: '删除模板',
      content: `确定要删除模板「${tpl.name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteCypherTemplate(tpl.templateId);
          message.success('模板已删除');
          await refreshTemplates();
        } catch {
          // swallowed
        }
      },
    });
  }, [refreshTemplates]);

  const handleAddTag = useCallback(() => {
    const t = tagsInput.trim();
    if (!t) return;
    if (!formTags.includes(t)) {
      setFormTags([...formTags, t]);
    }
    setTagsInput('');
  }, [tagsInput, formTags]);

  // -------- 按分类分组 --------

  const groupedTemplates = useMemo(() => {
    const map = new Map<CypherTemplateCategory, CypherTemplate[]>();
    ALL_CATEGORIES.forEach((c) => map.set(c, []));
    templates.forEach((tpl) => {
      const list = map.get(tpl.category) ?? [];
      list.push(tpl);
      map.set(tpl.category, list);
    });
    return map;
  }, [templates]);

  // -------- 结果表格 --------

  const resultColumns = useMemo(() => {
    if (!execution) return [];
    return execution.columns.map((col) => ({
      title: col,
      dataIndex: col,
      key: col,
      ellipsis: true,
      render: (value: unknown) => formatCellValue(value),
    }));
  }, [execution]);

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* 左：模板库侧边栏 */}
      <Card
        size="small"
        style={{ width: 300, flexShrink: 0 }}
        title={
          <Space size="small">
            <SnippetsOutlined />
            <span>查询模板</span>
          </Space>
        }
        extra={
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            title="保存当前查询为模板"
          />
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Input
            placeholder="搜索模板名称/描述/查询"
            prefix={<SearchOutlined />}
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            placeholder="选择分类"
            allowClear
            style={{ width: '100%' }}
            value={filterCategory}
            onChange={(v) => setFilterCategory(v as CypherTemplateCategory | undefined)}
            options={categories.map((c) => ({
              label: CATEGORY_LABELS[c as CypherTemplateCategory] ?? c,
              value: c,
            }))}
          />
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {templatesLoading ? (
              <Text type="secondary">加载中...</Text>
            ) : templates.length === 0 ? (
              <Empty description="暂无模板" imageStyle={{ height: 60 }} />
            ) : (
              ALL_CATEGORIES.map((cat) => {
                const items = groupedTemplates.get(cat) ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 4 }}>
                      <Tag color={CATEGORY_COLORS[cat]}>{CATEGORY_LABELS[cat]}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {items.length} 个
                      </Text>
                    </div>
                    {items.map((tpl) => (
                      <div
                        key={tpl.templateId}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #f0f0f0',
                          borderRadius: 4,
                          marginBottom: 6,
                          cursor: 'pointer',
                          background: '#fafafa',
                        }}
                        onClick={() => handleLoadTemplate(tpl)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text strong style={{ fontSize: 13 }}>
                            {tpl.name}
                          </Text>
                          <Space size={2}>
                            {tpl.builtin && <Tag color="default">内置</Tag>}
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(tpl);
                              }}
                            />
                            {!tpl.builtin && (
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTemplate(tpl);
                                }}
                              />
                            )}
                          </Space>
                        </div>
                        {tpl.description && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {tpl.description}
                          </Text>
                        )}
                        {tpl.tags && tpl.tags.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            {tpl.tags.map((t) => (
                              <Tag key={t} style={{ fontSize: 11 }}>
                                {t}
                              </Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </Space>
      </Card>

      {/* 右：编辑器 + 执行 + 结果 */}
      <Card
        size="small"
        style={{ flex: 1, minWidth: 0 }}
        title={
          <Space>
            <span>Cypher 查询控制台</span>
            <Tag color="blue">READ-ONLY</Tag>
          </Space>
        }
        extra={
          <Space size="small">
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={executing}
              onClick={handleExecute}
            >
              执行
            </Button>
            <Button
              size="small"
              icon={<SaveOutlined />}
              onClick={openCreateModal}
              title="保存当前查询为模板"
            >
              存为模板
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Editor
            height={260}
            language="sql"
            theme="vs-light"
            value={query}
            onChange={(value) => setQuery(value ?? '')}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
            }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            仅允许只读查询（MATCH / OPTIONAL MATCH / RETURN / WITH）；禁止 CREATE/MERGE/DELETE/SET 等写操作。
          </Text>
          {executionError && (
            <Alert
              type="error"
              showIcon
              message="执行失败"
              description={executionError}
              closable
              onClose={() => setExecutionError(null)}
            />
          )}
          {execution && (
            <Card
              size="small"
              title={
                <Space>
                  <Tag color="green">执行成功</Tag>
                  <Text type="secondary">
                    {execution.rowCount} 行 · {execution.columns.length} 列 · {execution.durationMs}ms
                  </Text>
                </Space>
              }
            >
              <Table
                size="small"
                rowKey={(_, idx) => String(idx)}
                dataSource={execution.rows}
                columns={resultColumns}
                pagination={{ pageSize: 10, size: 'small' }}
                scroll={{ x: 'max-content' }}
              />
            </Card>
          )}
        </Space>
      </Card>

      {/* 模板编辑 Modal */}
      <Modal
        open={editorModalOpen}
        title={editingTemplate ? '编辑模板' : '保存为模板'}
        onCancel={() => setEditorModalOpen(false)}
        onOk={handleSaveTemplate}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        width={620}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text type="secondary">模板名称</Text>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="例如：客户概念列表" />
          </div>
          <div>
            <Text type="secondary">分类</Text>
            <Select
              value={formCategory}
              onChange={(v) => setFormCategory(v as CypherTemplateCategory)}
              style={{ width: '100%' }}
              options={ALL_CATEGORIES.map((c) => ({
                label: CATEGORY_LABELS[c],
                value: c,
              }))}
            />
          </div>
          <div>
            <Text type="secondary">描述</Text>
            <Input.TextArea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="模板用途说明"
            />
          </div>
          <div>
            <Text type="secondary">标签</Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="输入标签后回车或点击添加"
                onPressEnter={handleAddTag}
              />
              <Button onClick={handleAddTag}>添加</Button>
            </Space.Compact>
            {formTags.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {formTags.map((t) => (
                  <Tag
                    key={t}
                    closable
                    onClose={() => setFormTags(formTags.filter((x) => x !== t))}
                  >
                    {t}
                  </Tag>
                ))}
              </div>
            )}
          </div>
          <div>
            <Text type="secondary">查询语句</Text>
            <Paragraph>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 8,
                  borderRadius: 4,
                  margin: 0,
                  fontSize: 12,
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {query}
              </pre>
            </Paragraph>
          </div>
        </Space>
      </Modal>
    </div>
  );
}

function formatCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <Text type="secondary">-</Text>;
  }
  if (typeof value === 'object') {
    return <Text code>{JSON.stringify(value)}</Text>;
  }
  return String(value);
}
