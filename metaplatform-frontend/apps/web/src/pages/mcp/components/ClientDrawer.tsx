import { useEffect, useState } from 'react';
import { Button, Form, SideSheet, Spin, Toast } from '@douyinfe/semi-ui';
import { SaveOutlined, ApiOutlined } from '@ant-design/icons';
import { createClient, getClient, testConnection, updateClient } from '@/api/mcphub/clients';
import type { McpClient, McpClientCreateRequest } from '@/api/mcphub/types';
import { EmptyState } from '@/components/skeleton';
import '../mcp.css';

/**
 * Client 表单抽屉宽度：11 个字段（含 3 个 JSON 文本域），
 * mp-mcp-form-grid 在 560 下收敛为单列，正是抽屉表单该有的排版。
 */
const DRAWER_W = 560;

const CLIENT_TYPE_OPTIONS = [
  { label: 'Cursor', value: 'cursor' },
  { label: 'Claude Desktop', value: 'claude-desktop' },
  { label: 'GitHub Copilot', value: 'copilot' },
  { label: 'Cline', value: 'cline' },
  { label: 'Windsurf', value: 'windsurf' },
  { label: '自定义', value: 'custom' },
];

const TRANSPORT_OPTIONS = [
  { label: 'HTTP', value: 'HTTP' },
  { label: 'SSE', value: 'SSE' },
  { label: 'STDIO', value: 'STDIO' },
];

const AUTH_OPTIONS = [
  { label: '无认证', value: 'none' },
  { label: 'API Key', value: 'apikey' },
  { label: 'Bearer Token', value: 'bearer' },
  { label: 'OAuth 2.0', value: 'oauth2' },
];

export interface ClientDrawerProps {
  open: boolean;
  /** null = 新建，否则为 Client 标识 */
  clientId: string | null;
  onClose: () => void;
  /** 保存成功后回调，父级据此刷新列表 */
  onSaved: () => void;
}

/**
 * MCP Client 新建 / 编辑抽屉（DESIGN-SPEC §5 骨架 E：新建·编辑走右侧抽屉）。
 * 由列表页按路由（/ki/mcp/clients/new、/ki/mcp/clients/:id/edit）驱动开关，
 * 因此深链与浏览器后退都能正确落到抽屉的开 / 关。
 */
export default function ClientDrawer({ open, clientId, onClose, onSaved }: ClientDrawerProps) {
  const [form] = Form.useForm<McpClientCreateRequest>();
  const [client, setClient] = useState<McpClient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (!clientId) {
      form.reset();
      setClient(null);
      setTestResult(null);
      setLoadError(null);
      form.setValues({ authType: 'none', clientType: 'custom', transportType: 'HTTP' });
      return;
    }

    setLoading(true);
    setLoadError(null);
    setTestResult(null);
    getClient(clientId)
      .then((c) => {
        setClient(c);
        form.setValues({
          name: c.name,
          endpoint: c.endpoint,
          clientType: c.clientType || 'custom',
          transportType: c.transportType || 'HTTP',
          authType: c.authType || 'none',
          apiKey: c.apiKey,
          timeoutMs: c.timeoutMs,
          headers: c.headers,
          serverIds: c.serverIds,
          config: c.config,
        });
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Client 加载失败'))
      .finally(() => setLoading(false));
  }, [open, clientId, form]);

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (clientId) {
        await updateClient(clientId, values);
        Toast.success('已更新');
      } else {
        await createClient(values);
        Toast.success('已创建');
      }
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!clientId) {
      Toast.warning('请先保存 Client');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const updated = await testConnection(clientId);
      const ok = updated.status.toLowerCase() === 'connected';
      setTestResult({ ok, message: ok ? '连接成功' : '连接失败' });
      Toast.success(ok ? '连接成功' : '连接失败');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '连接失败';
      setTestResult({ ok: false, message: msg });
      Toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <SideSheet
      visible={open}
      title={clientId ? `编辑 Client：${client?.name ?? ''}` : '添加 MCP Client'}
      width={DRAWER_W}
      onCancel={onClose}
      footer={
        <>
          {clientId ? (
            <Button
              icon={<ApiOutlined />}
              loading={testing}
              onClick={() => void handleTest()}
              className={
                testResult ? (testResult.ok ? 'mp-mcp-test-ok' : 'mp-mcp-test-fail') : undefined
              }
            >
              {testing ? '测试中' : testResult ? testResult.message : '测试连接'}
            </Button>
          ) : null}
          <Button onClick={onClose}>取消</Button>
          <Button
            theme="solid"
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            disabled={loading || !!loadError}
            onClick={() => void handleSubmit()}
          >
            保存
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="mp-text-center mp-p-8">
          <Spin />
        </div>
      ) : loadError ? (
        <EmptyState
          illustration="failure"
          title="Client 加载失败"
          desc={loadError}
          actions={<Button onClick={onClose}>关闭</Button>}
        />
      ) : null}

      {/*
        表单必须常驻挂载：Semi 的 form 实例在 <Form> 未挂载时 setValues 是空操作，
        把表单放进「加载中」分支会让回填值在表单挂载前丢失 —— 编辑态会永远显示空表单。
        因此 loading / error 一律用类名隐藏，不卸载。
      */}
      <div className={loading || loadError ? 'mp-mcp-hidden' : undefined}>
        <Form
          form={form}
          layout="vertical"
          render={({ values }) => (
            <>
              <div className="mp-grid mp-mcp-form-grid">
                <Form.Input
                  field="name"
                  label="名称"
                  rules={[{ required: true }]}
                  placeholder="例如：cursor-ide"
                />
                <Form.Input
                  field="endpoint"
                  label="MCP 端点 URL"
                  rules={[{ required: true, type: 'url', message: '请输入合法的 URL' }]}
                  placeholder="https://example.com/mcp/sse"
                />
                <Form.Select
                  field="clientType"
                  label="Client 类型"
                  rules={[{ required: true }]}
                  optionList={CLIENT_TYPE_OPTIONS}
                />
                <Form.Select
                  field="transportType"
                  label="传输协议"
                  rules={[{ required: true }]}
                  optionList={TRANSPORT_OPTIONS}
                />
                <Form.Select
                  field="authType"
                  label="认证方式"
                  rules={[{ required: true }]}
                  optionList={AUTH_OPTIONS}
                />
                {values.authType !== 'none' ? (
                  <Form.Input
                    field="apiKey"
                    label="API Key / Token"
                    rules={[{ required: true, message: '请输入认证凭证' }]}
                    placeholder="sk-..."
                    keepState
                  />
                ) : null}
                <Form.InputNumber
                  field="timeoutMs"
                  label="超时（ms）"
                  min={1000}
                  max={300000}
                  step={1000}
                  className="mp-w-full"
                />
              </div>
              <Form.TextArea
                field="headers"
                label="自定义 Headers（JSON）"
                rows={3}
                placeholder='{"X-Custom":"value"}'
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return true;
                      try {
                        JSON.parse(value);
                        return true;
                      } catch {
                        return new Error('请输入合法 JSON');
                      }
                    },
                  },
                ]}
              />
              <Form.TextArea
                field="serverIds"
                label="关联 Server IDs（JSON 数组）"
                rows={2}
                placeholder='["550e8400-e29b-41d4-a716-446655440000"]'
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return true;
                      try {
                        const parsed = JSON.parse(value);
                        if (!Array.isArray(parsed)) throw new Error('必须是数组');
                        return true;
                      } catch {
                        return new Error('请输入合法 JSON 数组');
                      }
                    },
                  },
                ]}
              />
              <Form.TextArea
                field="config"
                label="扩展配置（JSON）"
                rows={3}
                placeholder="{}"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return true;
                      try {
                        JSON.parse(value);
                        return true;
                      } catch {
                        return new Error('请输入合法 JSON');
                      }
                    },
                  },
                ]}
              />
            </>
          )}
        />
      </div>
    </SideSheet>
  );
}
