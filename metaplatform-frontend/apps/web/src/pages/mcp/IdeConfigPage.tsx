import { useEffect, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Form,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { CopyOutlined, DownloadOutlined, ReloadOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { generateServerIdeConfig } from '@/api/mcphub/ide-config';
import { listServers } from '@/api/mcphub/servers';
import type { IdeConfigResponse, IdeType, McpServer } from '@/api/mcphub/types';

SyntaxHighlighter.registerLanguage('json', json);

const IDE_OPTIONS: { label: string; value: IdeType }[] = [
  { label: 'Cursor', value: 'cursor' },
  { label: 'Claude Desktop', value: 'claude_desktop' },
  { label: 'Claude Code', value: 'claude_code' },
  { label: 'Copilot', value: 'copilot' },
  { label: '通用', value: 'generic' },
];

export default function IdeConfigPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [config, setConfig] = useState<IdeConfigResponse | null>(null);
  const [serverId, setServerId] = useState<string>('');
  const [ide, setIde] = useState<IdeType>('cursor');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listServers();
      setServers(res.items);
      if (res.items.length > 0 && !serverId) {
        setServerId(res.items[0]!.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载 Server 列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async () => {
    if (!serverId) {
      Toast.warning('请先选择 Server');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateServerIdeConfig(serverId, ide);
      setConfig(res);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '生成配置失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!config) return;
    try {
      await navigator.clipboard.writeText(config.content);
      Toast.success('已复制到剪贴板');
    } catch {
      Toast.error('复制失败，请手动复制');
    }
  };

  const handleDownload = () => {
    if (!config) return;
    const blob = new Blob([config.content], { type: config.contentType || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = config.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Toast.success('已下载');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin tip="加载 Server 列表..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <CloseCircleOutlined style={{ fontSize: 48, color: 'var(--semi-color-danger)' }} />
        <Typography.Title heading={4} style={{ marginTop: 16 }}>
          加载失败
        </Typography.Title>
        <Typography.Paragraph type="tertiary" style={{ marginTop: 8 }}>
          {error.message}
        </Typography.Paragraph>
        <Button
          theme="solid"
          type="primary"
          icon={<ReloadOutlined />}
          onClick={load}
          style={{ marginTop: 16 }}
        >
          重试
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          IDE 配置模板
        </Typography.Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Form>
          <Form.Label required>选择 Server</Form.Label>
          <Select
            filter
            placeholder="请选择要生成配置的 MCP Server"
            value={serverId || undefined}
            onChange={(v) => setServerId(v as string)}
            optionList={servers.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }))}
            style={{ maxWidth: 480 }}
          />
          <Form.Label required style={{ marginTop: 16 }}>
            IDE 类型
          </Form.Label>
          <RadioGroup
            type="button"
            value={ide}
            onChange={(e) => setIde(e.target.value as IdeType)}
          >
            {IDE_OPTIONS.map((o) => (
              <Radio key={o.value} value={o.value}>
                {o.label}
              </Radio>
            ))}
          </RadioGroup>
          <div style={{ marginTop: 16 }}>
            <Button theme="solid" type="primary" loading={generating} onClick={handleGenerate}>
              生成配置
            </Button>
          </div>
        </Form>
      </Card>

      {config && (
        <Card
          title={
            <Space>
              <span>生成结果</span>
              <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                {config.fileName}
              </Typography.Text>
            </Space>
          }
          headerExtraContent={
            <Space>
              <Button icon={<CopyOutlined />} onClick={handleCopy}>
                复制
              </Button>
              <Button theme="solid" type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
                下载
              </Button>
            </Space>
          }
        >
          <Banner
            type="info"
            description={`当前为 ${IDE_OPTIONS.find((i) => i.value === config.ideType)?.label || config.ideType} 配置格式，请按对应 IDE 的文档放置到正确位置。`}
            style={{ marginBottom: 16 }}
          />
          <SyntaxHighlighter language="json" style={oneLight} customStyle={{ margin: 0 }}>
            {config.content}
          </SyntaxHighlighter>
        </Card>
      )}
    </div>
  );
}
