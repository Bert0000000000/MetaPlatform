import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Empty,
  Input,
  InputGroup,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Toast,
} from '@douyinfe/semi-ui';
import {
  PlayCircleOutlined,
  SaveOutlined,
  ShareAltOutlined,
  SnippetsOutlined,
  HistoryOutlined,
  ExportOutlined,
  CopyOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import {
  executeCode,
  createCodeSnippet,
  updateCodeSnippet,
  createCodeShare,
  listCodeTemplates,
  createCodeTemplate,
  listCodeSnippetVersions,
  diffCodeSnippetVersions,
  getCodeSnippetVersion,
} from '@/api/superai/generate';
import type {
  CodeTemplate,
  CodeSnippet,
  CodeSnippetVersion,
  CodeSnippetDiffResult,
  ExecutionResult,
} from '@/api/superai/types';

const { Text, Paragraph } = Typography;

const LANGUAGE_OPTIONS = [
  { label: 'Python', value: 'python' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'SQL', value: 'sql' },
];

const MONACO_LANGUAGE_MAP: Record<string, string> = {
  python: 'python',
  typescript: 'typescript',
  sql: 'sql',
};

export interface CodeWorkspaceProps {
  initialCode: string;
  initialLanguage: string;
  description?: string;
  snippetId?: string;
  onSnippetChange?: (snippet: CodeSnippet | null) => void;
}

export default function CodeWorkspace({
  initialCode,
  initialLanguage,
  description,
  snippetId: initialSnippetId,
  onSnippetChange,
}: CodeWorkspaceProps) {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLanguage);
  const [snippetId, setSnippetId] = useState<string | undefined>(initialSnippetId);
  const [currentVersion, setCurrentVersion] = useState<number | undefined>(undefined);

  const [executing, setExecuting] = useState(false);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveChangeLog, setSaveChangeLog] = useState('');

  const [sharing, setSharing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<CodeTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<CodeSnippetVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<CodeSnippetDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Sync external code/language changes (e.g. when a new generation result arrives).
  useEffect(() => {
    setCode(initialCode);
    setLanguage(initialLanguage);
  }, [initialCode, initialLanguage]);

  const monacoLanguage = useMemo(
    () => MONACO_LANGUAGE_MAP[language] || 'plaintext',
    [language],
  );

  // ----------------------------------------------------------- REQ-041 / 042

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    try {
      const result = await executeCode(code, language);
      setExecution(result);
    } catch {
      // axios interceptor already surfaced the error via message.error
    } finally {
      setExecuting(false);
    }
  }, [code, language]);

  // ----------------------------------------------------------- REQ-040 / 044

  const openSaveModal = useCallback(() => {
    setSaveTitle(description ? description.slice(0, 60) : '未命名片段');
    setSaveChangeLog(snippetId ? '更新代码' : '');
    setSaveModalOpen(true);
  }, [description, snippetId]);

  const handleSave = useCallback(async () => {
    if (!saveTitle.trim()) {
      Toast.warning('请输入片段标题');
      return;
    }
    setSaving(true);
    try {
      if (snippetId) {
        const updated = await updateCodeSnippet(snippetId, {
          code,
          changeLog: saveChangeLog || `更新到 v${(currentVersion ?? 0) + 1}`,
        });
        setSnippetId(updated.snippetId);
        setCurrentVersion(updated.version);
        onSnippetChange?.(updated);
        Toast.success(`已保存到 v${updated.version}`);
      } else {
        const created = await createCodeSnippet({
          title: saveTitle,
          description,
          language,
          code,
        });
        setSnippetId(created.snippetId);
        setCurrentVersion(created.version);
        onSnippetChange?.(created);
        Toast.success(`已保存为新片段 (v${created.version})`);
      }
      setSaveModalOpen(false);
    } catch {
      // swallowed — error toast already shown
    } finally {
      setSaving(false);
    }
  }, [
    saveTitle,
    saveChangeLog,
    snippetId,
    currentVersion,
    code,
    description,
    language,
    onSnippetChange,
  ]);

  // ----------------------------------------------------------- REQ-044 history

  const openHistory = useCallback(async () => {
    if (!snippetId) {
      Toast.warning('请先保存片段后再查看历史版本');
      return;
    }
    setHistoryOpen(true);
    setDiffResult(null);
    setVersionsLoading(true);
    try {
      const items = await listCodeSnippetVersions(snippetId);
      setVersions(items);
    } catch {
      // swallowed
    } finally {
      setVersionsLoading(false);
    }
  }, [snippetId]);

  const handleDiff = useCallback(
    async (versionA: number, versionB: number) => {
      if (!snippetId) return;
      setDiffLoading(true);
      try {
        const result = await diffCodeSnippetVersions(snippetId, versionA, versionB);
        setDiffResult(result);
      } catch {
        // swallowed
      } finally {
        setDiffLoading(false);
      }
    },
    [snippetId],
  );

  const handleRestoreVersion = useCallback(
    async (version: number) => {
      if (!snippetId) return;
      try {
        const record = await getCodeSnippetVersion(snippetId, version);
        setCode(record.code);
        setLanguage(record.language);
        setCurrentVersion(record.version);
        Toast.success(`已加载 v${version} 内容到编辑器`);
      } catch {
        // swallowed
      }
    },
    [snippetId],
  );

  // ----------------------------------------------------------- REQ-043 templates

  const openTemplates = useCallback(async () => {
    setTemplatesOpen(true);
    setTemplatesLoading(true);
    try {
      const items = await listCodeTemplates();
      setTemplates(items);
    } catch {
      // swallowed
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const handleLoadTemplate = useCallback((template: CodeTemplate) => {
    setCode(template.code);
    setLanguage(template.language);
    setSnippetId(undefined);
    setCurrentVersion(undefined);
    setTemplatesOpen(false);
    Toast.success(`已加载模板：${template.name}`);
  }, []);

  const openTemplateModal = useCallback(() => {
    setTemplateName(description ? description.slice(0, 60) : '新模板');
    setTemplateCategory('general');
    setTemplateModalOpen(true);
  }, [description]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      Toast.warning('请输入模板名称');
      return;
    }
    try {
      await createCodeTemplate({
        name: templateName,
        language,
        code,
        category: templateCategory || undefined,
      });
      Toast.success('模板已保存');
      setTemplateModalOpen(false);
    } catch {
      // swallowed
    }
  }, [templateName, templateCategory, language, code]);

  // ----------------------------------------------------------- REQ-045 share

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const share = await createCodeShare({
        code,
        language,
        title: description ? description.slice(0, 80) : '代码片段分享',
      });
      setShareUrl(share.shareUrl);
      setShareModalOpen(true);
    } catch {
      // swallowed
    } finally {
      setSharing(false);
    }
  }, [code, language, description]);

  const handleExport = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'sql';
    a.download = `snippet-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [code, language]);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      Toast.success('已复制到剪贴板');
    } catch {
      Toast.error('复制失败，请手动选择文本复制');
    }
  }, [code]);

  // --------------------------------------------------------------- render

  const renderExecutionResult = () => {
    if (!execution) return null;
    if (!execution.success) {
      return (
        <Banner
          type="danger"
          title={`执行失败：${execution.errorName ?? 'Error'}`}
          description={execution.errorMessage ?? execution.stderr}
          style={{ marginTop: 8 }}
        />
      );
    }
    if (execution.resultType === 'table') {
      const columns = execution.columns.map((col) => ({
        title: col,
        dataIndex: col,
        key: col,
        ellipsis: true,
      }));
      return (
        <Card
          title={
            <Space>
              <Tag color="green">执行成功</Tag>
              <Text type="secondary">{execution.rowCount} 行 · {execution.durationMs}ms</Text>
            </Space>
          }
          style={{ marginTop: 8 }}
        >
          <Table
            rowKey="__rowKey"
            dataSource={execution.rows.map((r, idx) => ({ ...r, __rowKey: String(idx) }))}
            columns={columns}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      );
    }
    return (
      <Card
        title={
          <Space>
            <Tag color="green">执行成功</Tag>
            <Text type="secondary">{execution.durationMs}ms</Text>
          </Space>
        }
        style={{ marginTop: 8 }}
      >
        {execution.stdout && (
          <Paragraph style={{ marginBottom: 8 }}>
            <Text type="secondary">stdout:</Text>
            <pre style={{ background: 'var(--muted)', padding: 8, borderRadius: 4, margin: 4, fontSize: 12 }}>
              {execution.stdout}
            </pre>
          </Paragraph>
        )}
        {execution.text && (
          <Paragraph>
            <Text type="secondary">result:</Text>
            <pre style={{ background: 'var(--muted)', padding: 8, borderRadius: 4, margin: 4, fontSize: 12 }}>
              {execution.text}
            </pre>
          </Paragraph>
        )}
      </Card>
    );
  };

  const renderTemplatesModal = () => (
    <Modal
      visible={templatesOpen}
      title="代码模板库"
      footer={null}
      onCancel={() => setTemplatesOpen(false)}
      width={720}
    >
      <Space vertical spacing="tight" style={{ width: '100%' }}>
        <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openTemplateModal}>
          保存当前代码为模板
        </Button>
        {templatesLoading ? (
          <Text type="secondary">加载中...</Text>
        ) : templates.length === 0 ? (
          <Empty description="暂无模板" />
        ) : (
          <Table
            size="small"
            rowKey="templateId"
            dataSource={templates}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: '名称', dataIndex: 'name', key: 'name' },
              {
                title: '语言',
                dataIndex: 'language',
                key: 'language',
                width: 100,
                render: (v: string) => <Tag color="blue">{v}</Tag>,
              },
              { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
              {
                title: '操作',
                key: 'action',
                width: 80,
                render: (_: unknown, record: CodeTemplate) => (
                  <Button
                    theme="borderless"
                    size="small"
                    onClick={() => handleLoadTemplate(record)}
                  >
                    加载
                  </Button>
                ),
              },
            ]}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Space>
    </Modal>
  );

  const renderTemplateModal = () => (
    <Modal
      visible={templateModalOpen}
      title="保存为模板"
      onCancel={() => setTemplateModalOpen(false)}
      onOk={handleSaveAsTemplate}
      okText="保存"
      cancelText="取消"
    >
      <Space vertical spacing="medium" style={{ width: '100%' }}>
        <Input
          placeholder="模板名称"
          value={templateName}
          onChange={(v) => setTemplateName(v)}
        />
        <Input
          placeholder="分类（如 math / query / utility）"
          value={templateCategory}
          onChange={(v) => setTemplateCategory(v)}
        />
        <Text type="secondary">语言：{language} · 代码长度：{code.length} 字符</Text>
      </Space>
    </Modal>
  );

  const renderSaveModal = () => (
    <Modal
      visible={saveModalOpen}
      title={snippetId ? '保存为新版本' : '保存为代码片段'}
      onCancel={() => setSaveModalOpen(false)}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
    >
      <Space vertical spacing="medium" style={{ width: '100%' }}>
        <Input
          placeholder="片段标题"
          value={saveTitle}
          onChange={(v) => setSaveTitle(v)}
          disabled={!!snippetId}
        />
        {snippetId && (
          <Input
            placeholder="变更说明（可选）"
            value={saveChangeLog}
            onChange={(v) => setSaveChangeLog(v)}
          />
        )}
        <Text type="secondary">
          语言：{language} · 当前进度：
          {snippetId ? `v${currentVersion ?? 1} → v${(currentVersion ?? 1) + 1}` : '新建'}
        </Text>
      </Space>
    </Modal>
  );

  const renderShareModal = () => (
    <Modal
      visible={shareModalOpen}
      title="分享链接"
      onCancel={() => setShareModalOpen(false)}
      footer={[
        <Button key="copy" icon={<CopyOutlined />} onClick={() => {
          navigator.clipboard.writeText(shareUrl).then(() => Toast.success('链接已复制'));
        }}>
          复制链接
        </Button>,
        <Button key="close" theme="solid" type="primary" onClick={() => setShareModalOpen(false)}>
          关闭
        </Button>,
      ]}
    >
      <Paragraph>
        <Text type="secondary">分享链接（30 天有效）：</Text>
      </Paragraph>
      <InputGroup>
        <Input
          style={{ width: 'calc(100% - 100px)' }}
          value={shareUrl}
          readOnly
        />
        <Button
          theme="solid"
          type="primary"
          icon={<CopyOutlined />}
          onClick={() => {
            navigator.clipboard.writeText(shareUrl).then(() => Toast.success('链接已复制'));
          }}
        >
          复制
        </Button>
      </InputGroup>
    </Modal>
  );

  const renderHistoryModal = () => (
    <Modal
      visible={historyOpen}
      title="版本历史"
      onCancel={() => setHistoryOpen(false)}
      footer={null}
      width={900}
    >
      <Space vertical spacing="tight" style={{ width: '100%' }}>
        {versionsLoading ? (
          <Text type="secondary">加载中...</Text>
        ) : versions.length === 0 ? (
          <Empty description="暂无历史版本" />
        ) : (
          <>
            <Table
              size="small"
              rowKey={(record) => (record ? `${record.snippetId}-v${record.version}` : '')}
              dataSource={versions}
              pagination={false}
              columns={[
                {
                  title: '版本',
                  dataIndex: 'version',
                  key: 'version',
                  width: 60,
                  render: (v: number) => <Tag color="blue">v{v}</Tag>,
                },
                { title: '变更说明', dataIndex: 'changeLog', key: 'changeLog' },
                {
                  title: '更新时间',
                  dataIndex: 'updatedAt',
                  key: 'updatedAt',
                  width: 180,
                  render: (v?: string) => (v ? new Date(v).toLocaleString() : '-'),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 160,
                  render: (_: unknown, record: CodeSnippetVersion) => (
                    <Space spacing="tight">
                      <Button
                        size="small"
                        theme="borderless"
                        onClick={() => handleRestoreVersion(record.version)}
                      >
                        加载
                      </Button>
                      {versions.length > 1 && (
                        <Select
                          size="small"
                          placeholder="对比"
                          style={{ width: 90 }}
                          onChange={(target) => handleDiff(Number(target), record.version)}
                          value={undefined}
                          optionList={versions
                            .filter((v) => v.version !== record.version)
                            .map((v) => ({ value: v.version, label: `对比 v${v.version}` }))}
                        />
                      )}
                    </Space>
                  ),
                },
              ]}
              scroll={{ x: 'max-content' }}
            />
            {diffLoading && <Text type="secondary">计算差异中...</Text>}
            {diffResult && (
              <Card title={`差异：v${diffResult.versionA} → v${diffResult.versionB}`}>
                <Space vertical spacing="tight" style={{ width: '100%' }}>
                  {diffResult.addedLines.length > 0 && (
                    <div>
                      <Text type="success">新增（{diffResult.addedLines.length} 行）</Text>
                      <pre style={{ background: '#f6ffed', padding: 8, borderRadius: 4, fontSize: 12, margin: 4 }}>
                        {diffResult.addedLines.map((l) => `+ ${l}`).join('\n')}
                      </pre>
                    </div>
                  )}
                  {diffResult.removedLines.length > 0 && (
                    <div>
                      <Text type="danger">删除（{diffResult.removedLines.length} 行）</Text>
                      <pre style={{ background: '#fff2f0', padding: 8, borderRadius: 4, fontSize: 12, margin: 4 }}>
                        {diffResult.removedLines.map((l) => `- ${l}`).join('\n')}
                      </pre>
                    </div>
                  )}
                  <details>
                    <summary>查看 Unified Diff</summary>
                    <pre style={{ background: 'var(--muted)', padding: 8, borderRadius: 4, fontSize: 12, marginTop: 4 }}>
                      {diffResult.unifiedDiff}
                    </pre>
                  </details>
                </Space>
              </Card>
            )}
          </>
        )}
      </Space>
    </Modal>
  );

  return (
    <Card
      title={
        <Space>
          <span>代码工作台</span>
          {snippetId && <Tag color="purple">v{currentVersion}</Tag>}
          <Tag color="blue">{language}</Tag>
        </Space>
      }
      headerExtraContent={
        <Space spacing="tight">
          <Button
            size="small"
            theme="solid"
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={executing}
            onClick={handleExecute}
          >
            运行
          </Button>
          <Button
            size="small"
            icon={<SaveOutlined />}
            onClick={openSaveModal}
          >
            保存
          </Button>
          <Button
            size="small"
            icon={<ShareAltOutlined />}
            loading={sharing}
            onClick={handleShare}
          >
            分享
          </Button>
          <Button
            size="small"
            icon={<SnippetsOutlined />}
            onClick={openTemplates}
          >
            模板
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={openHistory}
            disabled={!snippetId}
          >
            历史
          </Button>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={handleCopyCode}
          >
            复制
          </Button>
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </Space>
      }
    >
      <Space vertical spacing="tight" style={{ width: '100%' }}>
        <Select
          value={language}
          onChange={(v) => setLanguage(v as string)}
          style={{ width: 160 }}
          optionList={LANGUAGE_OPTIONS}
        />
        <Editor
          height={360}
          language={monacoLanguage}
          theme="vs-light"
          value={code}
          onChange={(value) => setCode(value ?? '')}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
        {renderExecutionResult()}
      </Space>
      {renderSaveModal()}
      {renderShareModal()}
      {renderTemplatesModal()}
      {renderTemplateModal()}
      {renderHistoryModal()}
    </Card>
  );
}
