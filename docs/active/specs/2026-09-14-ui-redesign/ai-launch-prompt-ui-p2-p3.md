# UI-P2/P3 启动提示词：长尾收编 + 清理退役 + 验收收口

> 用法：新 AI 会话开场**整段粘贴本文件**（P2 各域可并行；P2d 与 P3 必须在 P1/P2 全部合入后串行执行）。
> 前置：UI-P0、UI-P1 五域已合入。

---

## 通用部分

你是 Mate Platform 前端工程师，执行 Calm Density 落地的收尾批次。纪律与 P1 相同：**一切按 Semi 官方方式**（DSM 主题 + 官方组件映射，Semi 有就禁止自绘，props 用 Semi MCP 核对）、零 `.semi-*` 覆盖、令牌间距、六骨架枚举、inline style 清零、v-* 退役、API 层不动。

必读：`DESIGN-SPEC.md`、原型 `index.html` 对应屏幕、P0 的 shell/skeleton 组件。

验证：9250 + admin/admin123（fetch→JWT）；Playwright 双主题截图；`pnpm build`。

---

## UI-P2a 应用中心（C 骨架）

`/apps`：应用卡片网格（图标/名称/状态 chip/版本/使用次数）+ 模板市场入口 banner + 我的模板 + AI 设计器 tab。现有 apphub 三 tab 逻辑（mine/market/my-templates/ai-designer）映射为页内 tab。应用详情/版本/表单与流程设计器**只换壳不换画布**（FlowGram 编辑器区域不动）。

## UI-P2b 知识与集成（E 骨架 + 两层 tab）

`/ki`：主 tab = 知识库 / MCP 工具 / A2A / 检索测试；MCP 下 segmented 子 tab（工具/服务器/客户端/调试器/权限/审计/连接监控）。知识库列表=DataTablePro（文档数/切片/向量模型/P95/重建进度），详情 SheetDetail。现有 `src/api/kb/*`、`src/api/mcphub/*` 不动。MCP 中心现有三 tab 结构拆散归位。

## UI-P2c 数据与治理（两层 tab 收编 20 页）

`/gov`：主 tab = 业务/数据/技术/治理，各 4 个子 tab。现有 arch 20 页大多是表格与表单——统一换 E 骨架 + DataTablePro + SheetDetail；血缘图复用 P1a 的 graph 组件（如有数据实体关系）。`ArchLayout` 侧栏导航整体删除。

## UI-P2d 清理退役（只删不加）

1. `grep -rn "v-" src --include="*.tsx" | grep className` 清零（v-badge 189/v-stat 23/v-page 22/v-btn 9/v-item 6/v-card 6…）
2. inline `style={{}}` 全站扫描，目标 < 100 处，且不允许出现颜色/字号/间距字面量（只允许布局性的 width/flex 数值）
3. 删除：legacy-redirects 中已无人引用的中间页组件、死路由、未用 import；`src/pages` 下孤儿目录
4. `src/App.css`（172 行 v-* 样式）清空退役
5. 每删一类跑全量 Playwright 确认无回归

提交：`chore(ui-p2d): retire legacy classes and inline styles`。

## UI-P3 验收收口

产出 `docs/active/specs/2026-09-14-ui-redesign/UI-ACCEPTANCE.md`，包含：

1. **视觉基线**：8 域 × 浅/深双主题 Playwright 截图归档（`tests/visual/ui-redesign/`）
2. **指标对照**（对照 UI-OPTIMIZATION-PLAN §2 基线）：
   - `grep -rh "style={{" src --include="*.tsx" | wc -l`（基线 4526 → 目标 <100）
   - v-* 类计数（基线 261 → 0）
   - `.semi-` 覆盖（0 → 0）
3. **路由对照表**：旧 100+ 路由 → 新 8 域映射全表（从 legacy-redirects.tsx 生成）
4. **交互验收**：⌘K 全域搜索跳转、Copilot dock 任意页面开合、详情 Sheet Esc 关闭、双主题切换
5. 8 域责任人/截图/日期三列表格，作为证据档

完成后在 `UI-OPTIMIZATION-PLAN.md` 批次表标记全部 ✅。

提交：`docs(ui-p3): UI optimization acceptance evidence`。
