import { useEffect, useState } from 'react';
import { Button, Form, SideSheet, Spin, Toast } from '@douyinfe/semi-ui';
import { createServer, getServer, updateServer } from '@/api/mcphub/servers';
import type { McpServerCreateRequest } from '@/api/mcphub/types';
import { EmptyState } from '@/components/skeleton';
import '../mcp.css';

const DRAWER_W = 560;

const TRANSPORT_OPTIONS = [
  { label: 'stdio', value: 'stdio' },
  { label: 'SSE', value: 'sse' },
  { label: 'HTTP', value: 'http' },
];

const AUTH_TYPE_OPTIONS = [
  { label: '无', value: 'none' },
  { label: 'API Key', value: 'apikey' },
  { label: 'OAuth2', value: 'oauth2' },
];

export interface ServerDrawerProps {
  open: boolean;
  /** null = 新建，否则为 server id */
  serverId: string | null;
  /** 可选暴露的工具（由列表页统一拉取后传入） */
  availableTools: Array<{ id: string; name: string }>;
  onClose: () => void;
  /** 保存成功后回调，父级据此刷新列表 */
  onSaved: () => void;
}

/**
 * MCP Server 新建 / 编辑抽屉（DESIGN-SPEC §5 骨架 E：新建·编辑一律右侧抽屉）。
 * 与 ToolDrawer / ClientDrawer / ResourceDrawer 同构：由列表页按路由
 * （/ki/mcp/servers/new、/ki/mcp/servers/:id/edit）驱动开关，自己按 id 取数。
 */
export default function ServerDrawer({
  open,
  serverId,
  availableTools,
  onClose,
  onSaved,
}: ServerDrawerProps) {
  const [form] = Form.useForm<McpServerCreateRequest>();
  const [authType, setAuthType] = useState<string>('none');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadError(null);

    if (!serverId) {
      form.reset();
      form.setValues({
        enabled: true,
        transport: 'sse',
        authType: 'none',
        toolIds: [],
        timeoutMs: 30000,
        maxConcurrentCalls: 100,
      });
      setAuthType('none');
      return;
    }

    setLoading(true);
    getServer(serverId)
      .then((s) => {
        form.setValues({
          name: s.name,
          code: s.code,
          description: s.description,
          transport: s.transport,
          endpoint: s.endpoint,
          host: s.host,
          port: s.port,
          sseEndpoint: s.sseEndpoint,
          authType: s.authType ?? 'none',
          authConfig: s.authConfig,
          timeoutMs: s.timeoutMs,
          maxConcurrentCalls: s.maxConcurrentCalls,
          healthCheckUrl: s.healthCheckUrl,
          toolIds: s.toolIds,
          enabled: s.enabled,
          tags: s.tags,
        });
        setAuthType(s.authType ?? 'none');
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Server 加载失败'))
      .finally(() => setLoading(false));
  }, [open, serverId, form]);

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (serverId) {
        await updateServer(serverId, values);
        Toast.success('已更新');
      } else {
        await createServer(values);
        Toast.success('Server 已创建');
      }
      onSaved();
      onClose();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideSheet
      visible={open}
      title={serverId ? '编辑 MCP Server' : '创建 MCP Server'}
      onCancel={onClose}
      width={DRAWER_W}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            theme="solid"
            type="primary"
            loading={submitting}
            disabled={loading || !!loadError}
            onClick={() => void handleSubmit()}
          >
            {serverId ? '保存' : '创建'}
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
          title="Server 加载失败"
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
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input
            field="code"
            label="编码"
            rules={[
              { required: true },
              { pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '字母数字下划线' },
            ]}
            disabled={!!serverId}
          />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Select
            field="transport"
            label="传输方式"
            rules={[{ required: true }]}
            optionList={TRANSPORT_OPTIONS}
          />
          <Form.Input
            field="endpoint"
            label="访问端点"
            rules={[{ required: true }]}
            placeholder="例如：/mcp/sse/main"
          />
          <Form.Input field="host" label="监听地址" placeholder="例如：0.0.0.0 或 127.0.0.1" />
          <Form.InputNumber
            field="port"
            label="监听端口"
            min={1}
            max={65535}
            className="mp-w-full"
            placeholder="例如：8080"
          />
          <Form.Input field="sseEndpoint" label="SSE 端点" placeholder="例如：/sse" />
          <Form.Select
            field="authType"
            label="认证方式"
            optionList={AUTH_TYPE_OPTIONS}
            onChange={(v) => setAuthType(v as string)}
          />
          {authType && authType !== 'none' && (
            <Form.TextArea
              field="authConfig"
              label="认证配置（JSON）"
              rows={3}
              placeholder='例如：{ "apiKey": "xxx" }'
            />
          )}
          <Form.InputNumber
            field="timeoutMs"
            label="超时时间（ms）"
            min={1}
            className="mp-w-full"
            placeholder="例如：30000"
          />
          <Form.InputNumber
            field="maxConcurrentCalls"
            label="最大并发调用数"
            min={1}
            className="mp-w-full"
            placeholder="例如：100"
          />
          <Form.Input
            field="healthCheckUrl"
            label="健康检查 URL"
            placeholder="例如：http://localhost:8080/health"
          />
          <Form.Select
            field="toolIds"
            label="暴露的工具"
            multiple
            placeholder="选择工具"
            optionList={availableTools.map((t) => ({ label: t.name, value: t.id }))}
          />
          <Form.Switch field="enabled" label="启用" />
          <Form.Select
            field="tags"
            label="标签"
            multiple
            placeholder="输入后回车"
            optionList={[]}
          />
        </Form>
      </div>
    </SideSheet>
  );
}
