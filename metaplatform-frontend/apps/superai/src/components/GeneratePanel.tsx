import { useState, useCallback } from 'react';
import {
  Button,
  Input,
  Card,
  Tag,
  Space,
  Typography,
  Select,
  Segmented,
  Alert,
  Descriptions,
  Table,
} from 'antd';
import {
  CodeOutlined,
  FormOutlined,
  NodeIndexOutlined,
  DashboardOutlined,
  PlayCircleOutlined,
  SafetyOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import {
  generateForm,
  generateProcess,
  generateCode,
  explainCode,
  reviewCode,
  generateDashboard,
} from '@/api/generate';
import { importToDesigner } from '@/utils/designerImport';
import CodeWorkspace from './CodeWorkspace';
import type {
  FormGenResult,
  ProcessGenResult,
  CodeGenResult,
  CodeReviewResult,
  DashboardGenResult,
  GenerateType,
  GeneratedConfig,
  CodeSnippet,
} from '@/types';

const { TextArea } = Input;

type GenMode = 'form' | 'process' | 'code' | 'explain' | 'review' | 'dashboard';

interface GeneratePanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  onResult: (metadata: { generatedConfig?: GeneratedConfig; codeReview?: CodeReviewResult }) => void;
  onImportToDesigner?: (config: GeneratedConfig) => void;
}

const GEN_MODES: { value: GenMode; label: string; icon: React.ReactNode }[] = [
  { value: 'form', label: '表单生成', icon: <FormOutlined /> },
  { value: 'process', label: '流程生成', icon: <NodeIndexOutlined /> },
  { value: 'code', label: '代码生成', icon: <CodeOutlined /> },
  { value: 'explain', label: '代码解释', icon: <CodeOutlined /> },
  { value: 'review', label: '代码审查', icon: <SafetyOutlined /> },
  { value: 'dashboard', label: '仪表盘生成', icon: <DashboardOutlined /> },
];

export default function GeneratePanel({ query, onQueryChange, onResult, onImportToDesigner }: GeneratePanelProps) {
  const [mode, setMode] = useState<GenMode>('form');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('python');
  const [formResult, setFormResult] = useState<FormGenResult | null>(null);
  const [processResult, setProcessResult] = useState<ProcessGenResult | null>(null);
  const [codeResult, setCodeResult] = useState<CodeGenResult | null>(null);
  const [explainResult, setExplainResult] = useState<GeneratedConfig | null>(null);
  const [reviewResult, setReviewResult] = useState<CodeReviewResult | null>(null);
  const [dashboardResult, setDashboardResult] = useState<DashboardGenResult | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [activeSnippet, setActiveSnippet] = useState<CodeSnippet | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      switch (mode) {
        case 'form': {
          const result = await generateForm(query);
          setFormResult(result);
          onResult({ generatedConfig: { type: 'form' as GenerateType, title: result.name, content: JSON.stringify(result, null, 2) } });
          break;
        }
        case 'process': {
          const result = await generateProcess(query);
          setProcessResult(result);
          onResult({ generatedConfig: { type: 'process' as GenerateType, title: result.name, content: result.bpmnXml } });
          break;
        }
        case 'code': {
          const result = await generateCode(query, language);
          setCodeResult(result);
          setActiveSnippet(null);
          onResult({ generatedConfig: { type: 'code' as GenerateType, title: result.description, content: result.code, language: result.language } });
          break;
        }
        case 'explain': {
          const result = await explainCode(codeInput);
          setExplainResult(result);
          onResult({ generatedConfig: result });
          break;
        }
        case 'review': {
          const result = await reviewCode(codeInput);
          setReviewResult(result);
          onResult({ generatedConfig: { type: 'review' as GenerateType, title: '代码审查报告', content: JSON.stringify(result, null, 2) }, codeReview: result });
          break;
        }
        case 'dashboard': {
          const result = await generateDashboard(query);
          setDashboardResult(result);
          onResult({ generatedConfig: { type: 'dashboard' as GenerateType, title: result.title, content: JSON.stringify(result, null, 2) } });
          break;
        }
      }
    } finally {
      setLoading(false);
    }
  }, [mode, query, language, codeInput, onResult]);

  const handleImportToDesigner = useCallback((config: GeneratedConfig) => {
    if (onImportToDesigner) {
      onImportToDesigner(config);
    } else {
      importToDesigner(config);
    }
  }, [onImportToDesigner]);

  const renderFormResult = () => {
    if (!formResult) return null;
    return (
      <Card size="small" title={formResult.name}>
        <Typography.Paragraph type="secondary">{formResult.description}</Typography.Paragraph>
        <Table
          size="small"
          dataSource={formResult.fields.map((f, i) => ({ ...f, key: i }))}
          columns={[
            { title: '标签', dataIndex: 'label', key: 'label' },
            { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
            { title: '字段标识', dataIndex: 'fieldKey', key: 'fieldKey' },
            { title: '必填', dataIndex: 'required', key: 'required', render: (v: boolean) => v ? <Tag color="red">必填</Tag> : <Tag>可选</Tag> },
          ]}
          pagination={false}
         scroll={{ x: 'max-content' }}/>
      </Card>
    );
  };

  const renderProcessResult = () => {
    if (!processResult) return null;
    return (
      <Card
        size="small"
        title={processResult.name}
        extra={
          <Button
            size="small"
            type="link"
            icon={<ExportOutlined />}
            onClick={() =>
              handleImportToDesigner({
                type: 'process' as GenerateType,
                title: processResult.name,
                content: JSON.stringify(processResult, null, 2),
                targetModuleType: 'flow',
              })
            }
          >
            应用到设计器
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">{processResult.description}</Typography.Paragraph>
        <Typography.Title level={5}>流程节点</Typography.Title>
        {processResult.nodes.map((node, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Tag color={node.type === 'startEvent' ? 'green' : node.type === 'endEvent' ? 'red' : 'blue'}>
              {node.type}
            </Tag>
            <Typography.Text>{node.name}</Typography.Text>
            {node.assignee && <Tag color="purple">{node.assignee}</Tag>}
          </div>
        ))}
        <Typography.Title level={5} style={{ marginTop: 12 }}>BPMN XML</Typography.Title>
        <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 12, overflow: 'auto' }}>
          {processResult.bpmnXml}
        </pre>
      </Card>
    );
  };

  const renderCodeResult = () => {
    if (!codeResult) return null;
    return (
      <CodeWorkspace
        initialCode={codeResult.code}
        initialLanguage={codeResult.language}
        description={codeResult.description}
        snippetId={activeSnippet?.snippetId}
        onSnippetChange={setActiveSnippet}
      />
    );
  };

  const renderExplainResult = () => {
    if (!explainResult) return null;
    return (
      <Card size="small" title={explainResult.title}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{explainResult.content}</pre>
      </Card>
    );
  };

  const renderReviewResult = () => {
    if (!reviewResult) return null;
    return (
      <Card size="small" title="代码审查报告">
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Alert
            type={reviewResult.overallScore >= 80 ? 'success' : reviewResult.overallScore >= 50 ? 'warning' : 'error'}
            message={`综合评分：${reviewResult.overallScore}/100`}
            showIcon
          />
          {reviewResult.securityIssues.length > 0 && (
            <Card size="small" title={<Typography.Text type="danger">安全问题</Typography.Text>}>
              <Table
                size="small"
                dataSource={reviewResult.securityIssues.map((i, idx) => ({ ...i, key: idx }))}
                columns={[
                  { title: '行', dataIndex: 'line', key: 'line', width: 60 },
                  { title: '严重度', dataIndex: 'severity', key: 'severity', render: (v: string) => <Tag color={v === 'critical' ? 'red' : v === 'warning' ? 'orange' : 'blue'}>{v}</Tag> },
                  { title: '问题', dataIndex: 'message', key: 'message' },
                  { title: '规则', dataIndex: 'rule', key: 'rule' },
                ]}
                pagination={false}
               scroll={{ x: 'max-content' }}/>
            </Card>
          )}
          {reviewResult.qualityIssues.length > 0 && (
            <Card size="small" title={<Typography.Text type="warning">质量问题</Typography.Text>}>
              <Table
                size="small"
                dataSource={reviewResult.qualityIssues.map((i, idx) => ({ ...i, key: idx }))}
                columns={[
                  { title: '行', dataIndex: 'line', key: 'line', width: 60 },
                  { title: '严重度', dataIndex: 'severity', key: 'severity', render: (v: string) => <Tag color={v === 'critical' ? 'red' : v === 'warning' ? 'orange' : 'blue'}>{v}</Tag> },
                  { title: '问题', dataIndex: 'message', key: 'message' },
                  { title: '规则', dataIndex: 'rule', key: 'rule' },
                ]}
                pagination={false}
               scroll={{ x: 'max-content' }}/>
            </Card>
          )}
          {reviewResult.suggestions.length > 0 && (
            <Card size="small" title="改进建议">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {reviewResult.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Card>
          )}
        </Space>
      </Card>
    );
  };

  const renderDashboardResult = () => {
    if (!dashboardResult) return null;
    return (
      <Card
        size="small"
        title={dashboardResult.title}
        extra={
          <Button
            size="small"
            type="link"
            icon={<ExportOutlined />}
            onClick={() =>
              handleImportToDesigner({
                type: 'dashboard' as GenerateType,
                title: dashboardResult.title,
                content: JSON.stringify(dashboardResult, null, 2),
                targetModuleType: 'page',
              })
            }
          >
            应用到设计器
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">{dashboardResult.description}</Typography.Paragraph>
        <Typography.Title level={5}>仪表盘组件</Typography.Title>
        {dashboardResult.widgets.map((w) => (
          <Descriptions key={w.id} size="small" bordered column={1} style={{ marginBottom: 8 }}>
            <Descriptions.Item label="标题">{w.title}</Descriptions.Item>
            <Descriptions.Item label="类型"><Tag color="blue">{w.type}</Tag></Descriptions.Item>
            <Descriptions.Item label="数据源">{w.dataSource}</Descriptions.Item>
          </Descriptions>
        ))}
        <Typography.Title level={5}>API 示例</Typography.Title>
        {dashboardResult.apiExamples.map((api, i) => (
          <Card key={i} size="small" style={{ marginBottom: 8 }}>
            <Space>
              <Tag color={api.method === 'GET' ? 'green' : 'blue'}>{api.method}</Tag>
              <Typography.Text code>{api.url}</Typography.Text>
            </Space>
            <Typography.Paragraph style={{ marginTop: 4 }}>{api.description}</Typography.Paragraph>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 12, overflow: 'auto' }}>
              {api.curl}
            </pre>
          </Card>
        ))}
      </Card>
    );
  };

  const showCodeInput = mode === 'explain' || mode === 'review';
  const showLanguageSelect = mode === 'code';

  return (
    <Card size="small" style={{ marginBottom: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as GenMode)}
          options={GEN_MODES.map((m) => ({ label: <Space size={4}>{m.icon}{m.label}</Space>, value: m.value }))}
          block
        />

        {showCodeInput ? (
          <TextArea
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="粘贴要解释或审查的代码..."
            rows={4}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        ) : (
          <>
            <TextArea
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={
                mode === 'form' ? '描述您想生成的表单，如：客户信息登记表单' :
                mode === 'process' ? '描述审批流程，如：费用报销审批流程' :
                mode === 'code' ? '描述代码需求，如：计算斐波那契数列前 10 项' :
                mode === 'dashboard' ? '描述仪表盘需求，如：销售数据分析仪表盘' :
                '请输入描述'
              }
              rows={2}
            />
            {showLanguageSelect && (
              <Select
                value={language}
                onChange={setLanguage}
                style={{ width: 160 }}
                options={[
                  { label: 'Python', value: 'python' },
                  { label: 'TypeScript', value: 'typescript' },
                  { label: 'SQL', value: 'sql' },
                ]}
              />
            )}
          </>
        )}

        <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={handleGenerate}>
          生成
        </Button>

        {formResult && renderFormResult()}
        {processResult && renderProcessResult()}
        {codeResult && renderCodeResult()}
        {explainResult && renderExplainResult()}
        {reviewResult && renderReviewResult()}
        {dashboardResult && renderDashboardResult()}
      </Space>
    </Card>
  );
}
