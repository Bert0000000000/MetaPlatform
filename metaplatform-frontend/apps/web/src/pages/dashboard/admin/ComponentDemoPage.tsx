import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Space, Tag, Divider, Form, Switch, Input, App } from "antd";
import {
  AdminLayout,
  StatCard,
  StatGrid,
} from "./__AdminLayout";
import {
  PlatformButton,
  PlatformPagination,
  MarkdownRenderer,
  PlatformMenu2,
  SectionCard,
  FormDrawer,
  PLATFORM_COMPONENTS_SKILL,
} from "@mate/shared";
import { listSkills, uploadSkill, updateSkill } from "@/api/mcphub/skills";

const MARKDOWN_SAMPLE = `# 组件展示

这是 **MarkdownRenderer** 的示例，支持：

- **加粗** / *斜体* / \`行内代码\` / ~~删除线~~
- [链接](https://example.com)
- 有序列表、表格、引用、代码块

| 组件 | 用途 |
| ---- | ---- |
| PlatformButton | 主/次/危险/幽灵按钮 |
| PlatformPagination | 统一分页 |
| MarkdownRenderer | AI 回复格式化 |

> 引用块：所有 AI 交互内容统一用此组件渲染。

\`\`\`tsx
<MarkdownRenderer content={text} variant="light" />
\`\`\`
`;

export default function ComponentDemoPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState(false);

  const handlePublishSkill = async () => {
    setPublishing(true);
    try {
      const existing = await listSkills({ q: 'platform-ui-components' });
      const body = {
        name: 'platform-ui-components',
        description: '平台通用 UI 组件清单（@mate/shared）：按钮 / 分页 / 菜单 / 表单抽屉 / 卡片 / 表格 / 状态反馈 / Markdown 渲染器。用这些组件快速搭建平台页面。',
        version: 'v1',
        visibility: 'public' as const,
        content: PLATFORM_COMPONENTS_SKILL,
      };
      const hit = existing.items?.find((s) => s.name === 'platform-ui-components');
      if (hit) {
        await updateSkill(hit.id, body);
        message.success('组件 Skill 已更新');
      } else {
        await uploadSkill(body);
        message.success('组件 Skill 已发布');
      }
      navigate('/mcp/skill-hub');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AdminLayout
      title="组件展示"
      extra={
        <PlatformButton variant="primary" loading={publishing} onClick={handlePublishSkill}>
          发布组件 Skill
        </PlatformButton>
      }
    >
      <StatGrid>
        <StatCard label="通用组件" value={4} color="success" />
        <StatCard label="渲染器" value={4} />
        <StatCard label="表单类" value={4} />
        <StatCard label="布局类" value={6} />
      </StatGrid>

      {/* 按钮 */}
      <SectionCard title="PlatformButton · 平台按钮">
        <Space wrap size={8}>
          <PlatformButton variant="primary">主按钮</PlatformButton>
          <PlatformButton variant="default">次按钮</PlatformButton>
          <PlatformButton variant="danger">危险按钮</PlatformButton>
          <PlatformButton variant="ghost">幽灵按钮</PlatformButton>
          <PlatformButton variant="primary" disabled>
            禁用
          </PlatformButton>
          <PlatformButton variant="default" size="small">
            小尺寸
          </PlatformButton>
          <PlatformButton variant="primary" size="small">
            小主按钮
          </PlatformButton>
        </Space>
      </SectionCard>

      {/* 分页 */}
      <SectionCard title="PlatformPagination · 平台分页">
        <PlatformPagination
          current={page}
          total={120}
          pageSize={10}
          onChange={(p) => setPage(p)}
        />
      </SectionCard>

      {/* MarkdownRenderer 浅色 */}
      <SectionCard title="MarkdownRenderer · 浅色（默认）">
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--card)" }}>
          <MarkdownRenderer content={MARKDOWN_SAMPLE} variant="light" />
        </div>
      </SectionCard>

      {/* MarkdownRenderer 深色 */}
      <SectionCard title="MarkdownRenderer · 深色（SuperAI 聊天）">
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "#0a0a0a" }}>
          <MarkdownRenderer content={MARKDOWN_SAMPLE} variant="dark" />
        </div>
      </SectionCard>

      {/* 多级菜单 */}
      <SectionCard title="PlatformMenu2 · 一级/二级菜单">
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ width: 200, border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
            <PlatformMenu2Preview />
          </div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", alignSelf: "center" }}>
            展示一级/二级嵌套菜单，自动高亮当前路由。
          </div>
        </div>
      </SectionCard>

      {/* 抽屉 */}
      <SectionCard title="FormDrawer · 表单抽屉（带 1/3·2/3·全屏切换）">
        <PlatformButton variant="primary" onClick={() => setDrawerOpen(true)}>
          打开表单抽屉
        </PlatformButton>
      </SectionCard>

      <FormDrawer
        open={drawerOpen}
        title="表单抽屉示例"
        onCancel={() => setDrawerOpen(false)}
        onOk={() => setDrawerOpen(false)}
      >
        <Form layout="vertical" size="small">
          <Form.Item label="示例字段">
            <Input placeholder="点击右上角切换 1/3·2/3·全屏" />
          </Form.Item>
          <Form.Item label="开关" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </FormDrawer>

      <Divider />

      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        所有组件均从 <Tag>@mate/shared</Tag> 导出，新页面统一引用，避免各自实现。
      </div>
    </AdminLayout>
  );
}

function PlatformMenu2Preview() {
  const items = [
    { key: "d1", label: "一级菜单 A", path: "/admin/components" },
    {
      key: "d2",
      label: "二级菜单组",
      children: [
        { key: "d2-1", label: "子项 1", path: "/admin/components" },
        { key: "d2-2", label: "子项 2", path: "/admin/configs" },
      ],
    },
    { key: "d3", label: "一级菜单 B", path: "/admin/logs" },
  ];
  return <PlatformMenu2Demo items={items} />;
}

function PlatformMenu2Demo({ items }: { items: any[] }) {
  return <PlatformMenu2 items={items} mode="inline" />;
}
