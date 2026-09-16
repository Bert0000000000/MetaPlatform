import { useEffect, useState } from 'react';
import { Button, Form, SideSheet, Spin, Toast } from '@douyinfe/semi-ui';
import { EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { createResource, getResource, updateResource } from '@/api/mcphub/resources';
import ContentPreview from './ContentPreview';
import type { McpResource, McpResourceCreateRequest } from '@/api/mcphub/types';
import { EmptyState } from '@/components/skeleton';
import '../mcp.css';

/** 资源表单抽屉宽度：内容字段（rows=12 的正文）需要比 456px 详情浮层更宽。 */
const DRAWER_W = 560;

const MIME_OPTIONS = [
  { label: 'text/plain', value: 'text/plain' },
  { label: 'text/markdown', value: 'text/markdown' },
  { label: 'application/json', value: 'application/json' },
  { label: 'image/png', value: 'image/png' },
  { label: 'image/jpeg', value: 'image/jpeg' },
  { label: 'application/pdf', value: 'application/pdf' },
];

export interface ResourceDrawerProps {
  open: boolean;
  /** null = 新建，否则为资源 id */
  resourceId: string | null;
  onClose: () => void;
  /** 保存成功后回调，父级据此刷新列表 */
  onSaved: () => void;
}

/**
 * 资源新建 / 编辑抽屉（DESIGN-SPEC §5 骨架 E：新建·编辑一律右侧抽屉）。
 * 由列表页按路由（/ki/mcp/resources/new、/ki/mcp/resources/:id）驱动开关，
 * 因此深链与浏览器后退都能正确落到抽屉的开 / 关。
 *
 * 预览开关只对已存在的资源可见（新建态没有可预览内容）；打开已有资源时自动进入预览态，
 * 与原整页表单的行为一致。
 */
export default function ResourceDrawer({
  open,
  resourceId,
  onClose,
  onSaved,
}: ResourceDrawerProps) {
  const [form] = Form.useForm<McpResourceCreateRequest>();
  const [resource, setResource] = useState<McpResource | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    // 关闭时退回编辑态：预览态下表单不挂载，下次打开先渲染表单、
    // 再对 form 实例赋值，避免操作尚未挂载的表单。
    if (!open) {
      setPreviewMode(false);
      return;
    }
    setResource(null);
    setPreviewMode(false);
    setLoadError(null);

    if (!resourceId) {
      form.reset();
      return;
    }

    setLoading(true);
    getResource(resourceId)
      .then((r) => {
        setResource(r);
        form.setValues({
          uri: r.uri,
          name: r.name,
          mimeType: r.mimeType,
          description: r.description,
          content: r.content,
          tags: r.tags,
        });
        setPreviewMode(true);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : '资源加载失败'))
      .finally(() => setLoading(false));
  }, [open, resourceId, form]);

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (resourceId) {
        await updateResource(resourceId, values);
        Toast.success('已更新');
      } else {
        await createResource(values);
        Toast.success('已创建');
      }
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideSheet
      visible={open}
      title={resourceId ? `编辑资源：${resource?.name ?? ''}` : '添加资源'}
      width={DRAWER_W}
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            theme="solid"
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            // 预览态下表单未挂载，无可提交内容，保存置灰（与原整页表单一致：预览时看不到保存）
            disabled={previewMode || loading || !!loadError}
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
          title="资源加载失败"
          desc={loadError}
          actions={<Button onClick={onClose}>关闭</Button>}
        />
      ) : null}

      {resource ? (
        <div className="mp-mb-4">
          <Button
            icon={<EyeOutlined />}
            onClick={() => setPreviewMode(!previewMode)}
            theme={previewMode ? 'solid' : 'light'}
            type={previewMode ? 'primary' : 'secondary'}
          >
            {previewMode ? '编辑模式' : '预览'}
          </Button>
        </div>
      ) : null}

      {/*
        表单必须常驻挂载：Semi 的 form 实例在 <Form> 未挂载时 setValues 是空操作，
        把表单放进「加载中」分支、或在预览态卸载它，回填值都写不进去 —— 编辑态会
        永远显示空表单。因此 loading / error / 预览态一律用类名隐藏，不卸载。
      */}
      <div
        className={
          loading || loadError || (previewMode && resource) ? 'mp-mcp-hidden' : undefined
        }
      >
        <Form form={form}>
          <Form.Input
            field="uri"
            label="资源 URI"
            rules={[{ required: true }, { pattern: /^[a-z][a-z0-9_:\-/]*$/, message: '小写 URI' }]}
            placeholder="docs://handbook/index.md"
            disabled={!!resourceId}
          />
          <Form.Input field="name" label="资源名称" rules={[{ required: true }]} />
          <Form.Select
            field="mimeType"
            label="MIME 类型"
            rules={[{ required: true }]}
            optionList={MIME_OPTIONS}
          />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.TextArea
            field="content"
            label="内容"
            rules={[{ required: true }]}
            rows={12}
            placeholder="文本/Markdown/JSON 字符串"
          />
          <Form.Select field="tags" label="标签" multiple optionList={[]} placeholder="输入后回车" />
        </Form>
      </div>

      {previewMode && resource ? <ContentPreview resource={resource} /> : null}
    </SideSheet>
  );
}
