# 节点库三段分组色族样式

把这段 CSS 粘到 `packages/shared/src/components/flow/flowgram-demo/index.css`
文件**末尾**（在 `.gedit-playground * { box-sizing: border-box; }` 之后），
保存后 vite HMR 会立即在浏览器生效。

三段色族：
- `审批流 (BPMN)`：蓝色 #2563eb
- `AI 协作流 (Agent)`：紫色 #a855f7
- `业务流程`：绿色 #10b981

每段差异：
- 标题文字 + 4px 高亮色条
- 卡片左侧 3px 色条
- 卡片图标底色 + 文字色 = 分组色
- hover 时背景填分组色 soft 版

```css
/* ===========================================================
   Mate: 节点库三段分组色族（BPMN / Agent / Business）
   按 .fg-node-group[data-group='bpmn|agent|business'] 切换
   =========================================================== */

.fg-node-group {
  --group-accent: #6366f1;
  --group-accent-soft: rgba(99, 102, 241, 0.18);
  margin-bottom: 18px;
}

.fg-node-group[data-group='bpmn'] {
  --group-accent: #2563eb;
  --group-accent-soft: rgba(37, 99, 235, 0.18);
}

.fg-node-group[data-group='agent'] {
  --group-accent: #a855f7;
  --group-accent-soft: rgba(168, 85, 247, 0.18);
}

.fg-node-group[data-group='business'] {
  --group-accent: #10b981;
  --group-accent-soft: rgba(16, 185, 129, 0.18);
}

.fg-node-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px 10px;
  margin-bottom: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--group-accent);
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
}

.fg-node-group-title::before {
  content: '';
  width: 4px;
  height: 12px;
  border-radius: 2px;
  background: var(--group-accent);
  box-shadow: 0 0 6px var(--group-accent);
}

.fg-node-group-title-count {
  margin-left: auto;
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0;
  text-transform: none;
}

.fg-node-card {
  position: relative;
  padding: 10px 12px 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.fg-node-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--group-accent);
  opacity: 0.7;
  transition: opacity 0.15s;
}

.fg-node-card:hover {
  background: var(--group-accent-soft);
  border-color: var(--group-accent);
}

.fg-node-card:hover::before { opacity: 1; }

.fg-node-card-icon {
  background: var(--group-accent-soft);
  color: var(--group-accent);
  transition: transform 0.15s, background 0.15s, color 0.15s;
}

.fg-node-card:hover .fg-node-card-icon {
  transform: scale(1.08);
  background: var(--group-accent);
  color: #fff;
}

.fg-node-card-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## 配套 React 组件修改

`node-add-panel.tsx` 第 97 行左右需要：

```tsx
<div key={group.key} className="fg-node-group" data-group={group.key}>
  <div className="fg-node-group-title">
    <span>{group.label}</span>
    <span className="fg-node-group-title-count">{group.registries.length}</span>
  </div>
  {group.registries.map((registry) => {
    const desc = registry.info?.description ?? '';
    return (
      <div key={...} className="fg-node-card">
        <span className="fg-node-card-icon">{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fg-node-card-name">{label}</div>
          {desc ? <div className="fg-node-card-desc">{desc}</div> : null}
        </div>
      </div>
    );
  })}
</div>
```

`editor.tsx` 的 `defaultPaletteGroups`：

```ts
function defaultPaletteGroups(registries) {
  const groups = {
    bpmn:     { key: 'bpmn',     label: '审批流 (BPMN)',    registries: [] },
    agent:    { key: 'agent',    label: 'AI 协作流 (Agent)', registries: [] },
    business: { key: 'business', label: '业务流程',         registries: [] },
  };
  for (const r of registries) {
    const t = String(r.type);
    if (t.startsWith('bpmn')) groups.bpmn.registries.push(r);
    else if (t.startsWith('agent')) groups.agent.registries.push(r);
    else groups.business.registries.push(r);
  }
  return Object.values(groups).filter(g => g.registries.length > 0);
}
```
