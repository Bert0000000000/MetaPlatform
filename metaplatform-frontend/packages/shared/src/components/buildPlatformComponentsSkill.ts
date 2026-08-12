import { COMPONENT_MANIFEST, type ComponentCategory } from './componentManifest';

/**
 * 从组件 manifest 生成 SKILL.md（skillhub 可发布的组件 skill）。
 *
 * 产出格式：YAML frontmatter（name/description）+ 正文（组件分类索引 +
 * 每组件 props 表 + 用法示例）。agent 未来可按此清单发现并复用平台组件
 * 搭建应用。
 */

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  button: '按钮',
  navigation: '导航',
  form: '表单',
  layout: '布局',
  data: '数据',
  feedback: '状态反馈',
  renderer: '渲染器',
};

export function buildPlatformComponentsSkillMd(): string {
  const lines: string[] = [];
  lines.push(`---
name: platform-ui-components
description: 平台通用 UI 组件清单（@mate/shared）。可复用的按钮 / 分页 / 菜单 / 表单抽屉 / 卡片 / 表格 / 状态反馈 / Markdown 渲染器。搭建平台页面时优先从这里选组件，避免重复实现。
---`);
  lines.push('');
  lines.push('# 平台通用组件（@mate/shared）');
  lines.push('');
  lines.push('> 用这些组件快速搭建平台页面。所有组件从 `@mate/shared` 导入。');
  lines.push('');

  // 分类索引
  const categories = Array.from(new Set(COMPONENT_MANIFEST.map((c) => c.category)));
  lines.push('## 组件索引');
  lines.push('');
  lines.push('| 分类 | 组件 | 用途 |');
  lines.push('| ---- | ---- | ---- |');
  for (const cat of categories) {
    const members = COMPONENT_MANIFEST.filter((c) => c.category === cat);
    for (const m of members) {
      lines.push(`| ${CATEGORY_LABELS[cat]} | \`${m.name}\` | ${m.description} |`);
    }
  }
  lines.push('');

  // 每组件详情
  lines.push('## 组件详情');
  lines.push('');
  for (const m of COMPONENT_MANIFEST) {
    lines.push(`### ${m.name}`);
    lines.push('');
    lines.push(m.description);
    lines.push('');
    if (m.props?.length) {
      lines.push('| prop | 类型 | 默认 | 说明 |');
      lines.push('| ---- | ---- | ---- | ---- |');
      for (const p of m.props) {
        lines.push(`| \`${p.name}\` | ${p.type} | ${p.default ?? '-'} | ${p.description} |`);
      }
      lines.push('');
    }
    if (m.example) {
      lines.push('```tsx');
      lines.push(m.example);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

export const PLATFORM_COMPONENTS_SKILL = buildPlatformComponentsSkillMd();
