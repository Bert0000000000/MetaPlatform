# Mate Platform UI 重设计 · 设计规范 v1.0

> **状态**：原型评审稿（2026-09-14）· 待用户确认后进入模块替换
> **配套原型**：[index.html](./index.html)（单文件、零依赖、双主题；`Ctrl K` 唤起命令面板，左侧 rail 切换 8 个域）
> **定位**：完全重来的设计基线，**不以现有 UI 为参考**，只盘点现有功能域作为信息架构输入。

---

## 0. 设计理念：Calm Density（冷静的密度）

企业数据平台的界面应该同时做到两件矛盾的事：**信息密度高**（一屏看到尽可能多的有效信息）与**视觉冷静**（不刺眼、不花哨、层级清晰）。

三条产品级原则：

| # | 原则 | 含义 | 反例（当前 UI 的病根） |
|---|------|------|------------------------|
| 1 | **对象优先**（Object-first，Palantir 范式） | 平台的心智模型是「本体对象 + 动作」，一切页面围绕对象浏览/编辑/执行展开 | 菜单按技术分层堆砌（superai 下挂 16 个平级路由） |
| 2 | **单一强调色**（Linear 范式） | 全局只有 1 个品牌色表达「可交互/进行中」；绿/橙/红只表状态，紫/青只表分类 | 各模块自选色、到处高亮，视觉噪音大 |
| 3 | **AI 平权入口** | SuperAI 不是一个页面，而是**全局侧栏 Copilot + ⌘K**，任何页面都能唤起 | AI 能力藏在固定菜单深处 |

---

## 1. 调研输入（2026-09 互联网调研）

| 来源 | 采纳要点 |
|------|----------|
| [Palantir Foundry · Object Explorer](https://palantir.com/docs/foundry/object-explorer/getting-started/) | 「方位舱」（orientation hub）首页；对象浏览器 = 搜索 + 筛选 + 结果 + 详情；探索可保存复用 |
| [Linear 设计体系分析](https://open-design.ai/plugins/design-system-linear-app/) / [DESIGN.md](https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md) | 近黑画布深色主题、单一强调色、紧凑精确的字排（负字距）、克制阴影 |
| [Command Palette 模式](https://uxpatterns.dev/patterns/advanced/command-palette) / [Superhuman 实践](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/) / [Retool 案例](https://retool.com/blog/command-palette) | ⌘K 全局绑定、模糊搜索、导航+动作统一入口、常用优先 |
| [2026 Bento Grid 趋势](https://www.sanjaydey.com/ux-ui-design-trends-2026-biggest/) / [Figma 趋势报告](https://www.figma.com/resource-library/web-design-trends/) | 工作台用便当格模块化布局，大小块区分信息优先级 |
| [SaaS 导航模式](https://www.saasui.design/blog/saas-navigation-ux-patterns) / [Pencil & Paper 导航分析](https://www.pencilandpaper.io/articles/ux-pattern-analysis-navigation) | 图标栏 + 二级面板双层导航；对象型/任务型/流程型导航分治 |
| [侧边栏最佳实践](https://www.alfdesigngroup.com/post/improve-your-sidebar-design-for-web-apps) | 分组标签、可折叠、宽度 232–280px、状态清晰 |

---

## 2. 信息架构重组（11 域 → 8 域）

现有约 100+ 路由收敛为 8 个顶级域。核心动作：**SuperAI 16 条路由收拢为 4 类**、**DW 并入数字员工**、**Knowledge + MCP 合并为知识与集成**、**Arch + 数据治理合并为治理**。

| # | 新域 | 吸收的现有模块 | 二级分组 |
|---|------|----------------|----------|
| 1 | **工作台** | dashboard / portal / messages / notifications / deliverables / my-apps / my-agents / aiops | 总览 · 待办审批 · 我的任务 · 消息 · 交付物 |
| 2 | **本体** | ontology（建模 tabs）/ datacenter | 建模（对象/关系/动作/函数/接口/公理）· 探索（对象浏览器 · **数据中心：知识图谱/血缘/资产**）· 运维（接入 · 版本 · 审计） |
| 3 | **数字员工** | agents + dw（全部 9 页） | 员工（列表 · 外部 A2A）· 运行（任务 · 协作 · 历史）· 成长（评估 · 学习）· 文档处理 |
| 4 | **SuperAI** | superai 16 条路由 + wfe/action-orchestration | 编排（会话 · 意图调度 · 执行计划 · 结果聚合）· 洞察（成本 · 报告）· 模板 |
| 5 | **应用中心** | apps / apphub / marketplace / my-templates / ai-designer | 应用 · 市场 · 构建（AI 设计器） |
| 6 | **知识与集成** | knowledge + mcp 中心全部 | 知识（库 · 文档 · 检索测试）· MCP（工具 · 服务器 · 客户端 · 调试）· A2A（外部员工 · 信任）· 运维（权限 · 审计 · 连接监控） |
| 7 | **数据与治理** | arch 全部 20 页 + 数据平台 | 业务架构 · 数据架构 · 技术架构 · 治理（原则 · 评审 · 技术债 · 本体映射） |
| 8 | **平台管理** | admin 11 页 | 组织（用户 · 角色 · 租户）· 平台（配置 · AI Provider · 模型组件）· 运维（审计 · 监控 · 分析） |

> 重组后每个域的二级项 ≤ 15 个且分 ≤ 4 组，符合 [导航层级最佳实践](https://www.pencilandpaper.io/articles/ux-pattern-analysis-navigation)。

---

## 3. 应用壳（App Shell）· 一级导航 + 页内 tab（2026-09-14 v1.2 重构）

**取消全局二级导航面板**，二级菜单全部收敛为各域页面顶部的 tab 栏。一级导航保留两种模式一键切换（顶栏布局按钮 / ⌘K 动作）：

```
模式 A · 侧栏一级（VS Code / Datadog 范式）          模式 B · 顶栏一级（GitHub / Grafana 范式）
┌──┬────────────────────────────────────┐    ┌───────────────────────────────────────────┬────┐
│R │ 顶栏：面包屑 ∥ ⌘K · 环境 · 通知 · 布局 │    │ 一级 tab 横排（图标+文字）∥ ⌘K · 主题 · 布局 │Cop │
│A ├────────────────────────────────────┤    ├───────────────────────────────────────────┴────┤
│I │ 页内主 tab 行（44px，sticky）         │    │  页内主 tab 行（44px，sticky）                  │
│L │ [子 tab 行（胶囊，仅多子项域）]        │    │  [子 tab 行（胶囊，仅多子项域）]                │
│  │  内容区（全宽 +232px）                 │    │  内容区（全宽）                                  │
└──┴────────────────────────────────────┘    └─────────────────────────────────────────────────┘
```

| 层 | 规则 |
|----|------|
| **一级** | 8 域；模式 A=图标栏 56px，模式 B=顶栏横向 tab（图标+文字，active 下划线）。模式 B 可发现性更好（带文字） |
| **页内主 tab** | 每域 4–6 个，顶栏下方 44px 通栏 sticky，active 主色下划线；计数徽标（待办 2）挂在 tab 上；切换即路由（`/ontology/datacenter`） |
| **子 tab（胶囊）** | 仅多子项域（知识 MCP 7 项、治理 4×4、管理 3×3、本体建模 6 项）：主 tab 下第二行胶囊，sticky 跟随 |
| 面包屑 | 域 / 主 tab / 子 tab |
| 收益 | 全局壳减少 232px；tab 切换视觉连续；「沉浸模式」不再是特例（天然全宽） |

**各域 tab 结构**：工作台 6 扁平（概览/待办/任务/消息/交付物/我的）· 本体 4（对象浏览器/数据中心/类型建模/运维，建模含 6 子 tab）· 数字员工 6 扁平 · SuperAI 5 扁平 · 应用 4 扁平 · 知识与集成 4（MCP·7 子/A2A·2 子）· 治理 4 主 × 4 子 · 管理 3 主 × 3 子。

**面板交互（三栏浏览器页）**：类型树 180–360px、详情 260–460px；边界拖拽调宽（hover 主色高亮）、双击折叠、折叠态单击/竖排标签展开、`[` `]` 快捷键切换、宽度过渡 0.18s、折叠/展开记住拖拽宽度。

---

## 4. 设计令牌（与 Semi Design 映射）

> **实现约束（官方方式）**：Semi 侧令牌（颜色/圆角/字号）通过 **DSM 主题包**（`packages/semi-theme-mate` + `@douyinfe/semi-vite-plugin`）在构建期替换官方 SCSS 变量，禁止运行时覆盖 `--semi-color-*`（对编译期展开的值不生效）；深色走官方 `body[theme-mode]`。下表「Semi 映射」列即 DSM 包内变量对照。平台布局令牌（间距 10 档、rail/tab/sheet 宽度）是 Semi 没有的能力，放 `src/styles/tokens.css`（`--mp-*`，禁止出现 `--semi-*`）。组件一律官方优先：`Layout/Nav/Tabs/Table/SideSheet/Descriptions/Timeline/Steps/Empty/Toast…`，Semi 没有的（⌘K、力导向图谱）才组合/自建。

间距 **4px 基网格**；字号 **6 级**；圆角 **3 级**；每处改动都映射到 Semi token，落地时改主题变量即可，无需逐页调。

### 4.1 间距与密度

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--s-1…--s-10` | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 | 全部边距间距只允许取这 10 个值 |
| 表格行高 | 40px（紧凑 32px） | 对应 Semi Table `size="middle/default"` |
| 菜单项高 | 32px | Semi Nav item |
| 卡片内边距 | 16px（小卡 12px） | — |

### 4.2 字排

| 级 | 字号/行高 | 用途 | Semi 映射 |
|----|-----------|------|-----------|
| display | 26–28 / 1.1，字距 -0.02em | KPI 数字（tabular-nums） | — |
| h1 | 20 / 1.25 | 页面标题 | `--semi-font-size-regular`+ |
| h2 | 15–16 | 区块/卡片标题 | — |
| body | 14 / 1.5 | 正文 | 默认 |
| small | 13 / 1.5 | 表格、导航 | Table/Nav 默认 |
| caption | 12 / 1.4 | 辅助说明、时间戳 | `--semi-font-size-small` |

字族：`-apple-system, "Segoe UI", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif`（不引入网络字体）。

### 4.3 颜色

| 令牌 | 浅色 | 深色 | Semi 映射 |
|------|------|------|-----------|
| `--bg-page` | `#F5F6F8` | `#0D0F13` | `--semi-color-bg-0` |
| `--bg-surface` | `#FFFFFF` | `#15181D` | `--semi-color-bg-1`（卡片） |
| `--bg-rail/nav` | `#FBFBFC` / `#FFF` | `#101318` | `--semi-color-nav-bg` |
| `--border` | `#E7E9EF` | `#242832` | `--semi-color-border` |
| `--text-1/2/3` | `#191D24` / `#4B5262` / `#8A91A2` | `#E9EBEF` / `#A3AAB7` / `#7B8391` | `--semi-color-text-0/1/2` |
| `--accent` | `#3B5BF6`（悬停 `#2F4BE0`） | `#7C8FFF` | `--semi-color-primary` |
| success / warning / danger | `#1E8A5A` / `#A96A08` / `#D34040` | `#4BC58B` / `#E5A73D` / `#F07A7A` | `--semi-color-success/warning/danger` |
| purple / cyan | `#7A5AF8` / `#0E7C93` | `#A18BFF` / `#55BCD3` | 仅分类标签 |

规则：**主色只表达「可交互/选中/进行中」**；语义三色只出现在状态 chip/圆点/进度；分类两色只用于对象域类别。阴影极轻（卡片 `0 1px 2px`），层级靠边框与背景差而非阴影；深色主题下弹层用提亮表面 + 边框。

### 4.4 圆角

卡片 12px · 输入/按钮 8px · chip/tag 6px（对应 Semi `--semi-border-radius-medium/small`）。不做大圆角（>16px）。

---

## 5. 页面骨架（只有 5 种版式）

全平台页面必须归入以下五种骨架之一，**禁止新增第六种**：

| 版式 | 结构 | 适用 | 原型示例 |
|------|------|------|----------|
| **A 工作台** | 页头 + KPI bento 行 + 主列(动态/最近) / 侧列(待办/状态) | 各域首页 | 工作台 |
| **B 两栏浏览器 + Preview Sheet** | 类型树(240，可折叠/拖宽) + **满宽表格**（列头排序/冻结/列设置）；点行 → 右侧**滑出 456px 非模态详情浮层**（Esc/× 关闭，表格仍可操作，底部「新标签页打开/编辑」）——Foundry Selection Preview + Semi SideSheet 范式 | 对象/文档/工具等一切「浏览-选中-看详情」 | 本体·对象浏览器 |
| **C 卡片网格** | 页头 + 筛选栏 + 卡片网格（+ 虚线新建卡） | 员工/应用/知识库/模板 | 数字员工 · 应用中心 |
| **D 流程详情** | 页头 + 状态条 + 垂直步骤时间线（子任务进度）+ 侧列(参与方/HITL/成本) | 执行计划/任务/编排 | SuperAI·执行计划 |
| **E 表格页** | 页头 + 筛选栏 + 表格 + 分页；新建/编辑一律右侧抽屉(420px) | 管理/审计/清单 | 平台管理·用户 |
| **F 全屏可视化** | 工具条(视图切换/搜索/图例过滤/布局) + 全幅画布 + 浮层详情卡；进入即沉浸 | 知识图谱/血缘/画布类 | 本体·数据中心 |

**沉浸模式（2026-09-14 v1.3 修订）**：tab 化后全局已无二级导航面板，所有页面天然全宽，「沉浸模式」概念废止。详情一律走 Preview Sheet 浮层（对齐 [Foundry Selection Preview](https://palantir.com/docs/foundry/object-explorer/view-results/)：点击行右侧滑出、可收起获得完整表格、多选切换预览）与 [Semi SideSheet](https://semi.design/zh-CN/show/sidesheet)（448px/非模态/Esc）。**控件预算纪律**：单个工作区同时可见的横向切换控件 ≤2 种（主 tab 行 + 工作区内 segmented）；一个面板的控制入口 ≤2 个（折叠按钮 + 拖宽边界）；禁止自创交互（如竖排文字标签）。知识图谱为自研力导向（斥力/弹簧/向心 + 拖拽钉住 + 邻接高亮 + 类型过滤），不引入第三方图库。

共享元素：页头（标题+描述+主操作右对齐）、空状态（图标+一句话+动作）、Toast（右下角）、骨架屏。

---

## 6. 交互范式

1. **⌘K 命令面板**：`Ctrl K` 全局；分组=最近/跳转/对象/员工/动作；模糊过滤；Enter 打开。是导航的第二通道，不替代可见菜单。
2. **Copilot 全局侧栏**：rail 底部 sparkle 常驻；打开时感知当前页面对象（上下文条）；AI 产出=**计划卡片**（步骤+费用+风险标注+「确认执行/修改」），对应平台「AI proposal + HITL」哲学。
3. **HITL 一致性**：所有需人工确认的动作走同一控件——计划卡内嵌按钮或工作台待办卡，绝不弹裸 confirm()。
4. **状态语义**：运行中=主色呼吸点；完成=绿；失败/待确认=红/橙；空闲=灰。进度条 5px。
5. **深浅双主题**：默认浅色（企业日常），深色一键切换，所有令牌双值维护。

---

## 7. 迁移策略（讨论确认后执行）

| 阶段 | 内容 | 验收 |
|------|------|------|
| **P0 壳与令牌** | 建 `AppShell`（rail+二级导航+顶栏+Copilot dock+⌘K），Semi 主题令牌按 §4 覆盖；新 IA 路由表（旧路由 301 到新） | 全部页面在新壳内可打开（内容暂用旧页面），双主题正常 |
| **P1 五骨架组件** | PageHeader / FilterBar / DataTable 规范 / DrawerForm / EmptyState 五套共享组件 + Playwright 视觉基线 | 组件 demo 页 + 用例绿 |
| **P2 核心域替换** | 顺序：工作台 → 对象浏览器 → 数字员工 → SuperAI 执行计划 → 管理（每域一个 PR，Conventional Commits） | 每域替换后截图对比评审 |
| **P3 长尾收编** | 知识与集成 · 治理 · 应用中心 → 清理旧路由与死代码 | 路由表中无 P0 前路径；`/marketplace` 等别名 301 |

约束：沿用 Semi 组件库（已全量迁移），不引第三方 UI 库；每步在 9250 dev server 上真 token 验证（见既有验证流程）。

---

## 8. 评审清单（给本次讨论）

- [ ] 8 域 IA 划分是否认可？（尤其：DW 并入数字员工、Knowledge+MCP 合并、Arch 更名治理）
- [ ] 主色 `#3B5BF6` 靛蓝是否认可？还是要更企业蓝（Semi 默认）/更紫（Linear 风）？
- [ ] 默认主题浅色、深色一键切换，是否符合使用场景？
- [ ] Copilot 全局侧栏（AI 无处不在）vs 独立 SuperAI 页面，交互取舍？
- [ ] 密度：表格 40px 行高是否合适（还有 32px 紧凑档）？
- [ ] 迁移阶段顺序是否调整？
