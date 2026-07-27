# MetaPlatform 代码审查报告（2026-07-27）

> 分支：`codex/ontology-native-deerflow-delivery`
> 评审范围：工作树全部未提交修改 + 最近 2 天（2026-07-25 ~ 2026-07-27）提交内容
> 总览：**266 个修改** + **86 个未跟踪文件**（多数集中在 `TECH-AGENT` 与 `metaplatform-frontend`）
> 编码：UTF-8 (no BOM)
> 状态：仅审查，未做任何代码改动；问题清单见 §6

---

## 0. 总评（TL;DR）

| 维度 | 状态 | 说明 |
|---|---|---|
| 与 CLAUDE.md 目标对齐度 | **中** | 本轮集中在 DeerFlow 收尾 + FlowGram 落地，符合 v1.4 阶段定义 |
| 后端工程化 | **中** | 单一职责总体清晰，但出现"破坏封装"和"绕过安全"的反模式 |
| 前端工程化 | **弱** | 缺失单元测试、kb 应用版本偏离基线、巨型单文件 |
| 可运维性 | **中** | 一次性调试脚本堆叠在 `scripts/`，未来需要清理 |
| 文档完整性 | **强** | `docs/superpowers/specs/` 内容充分、§17 自检表清晰 |
| 上线就绪度 | **未达** | §17.2 item 1（跨服务 `mvn-boot`）仍为 CI 缺口 |

**最关键风险**：① 框架类影子化 ② Spring Security 全局关闭 ③ 包路径与目录名不一致 ④ 前端零测试 ⑤ kb 子应用与基线版本脱节。这五项任何一项单独都足以阻塞合并。

---

## 1. 与项目目标的一致性

CLAUDE.md 把 v1.4 重构期明确为「FlowGram 全能力补齐」+「Sprint 1 完成」。评审对应情况：

| Sprint 计划项 | 本轮对应提交 / 状态 | 评价 |
|---|---|---|
| 组件库流程画布集成 FlowGram editor + 节点库 | 工作树中 `flowgram-editor.tsx`、`node-render-v2.tsx`、`custom-base-node.tsx`（均未提交） | **完成度：源码级 ✅ / 提交级 ❌** — 大量相关文件仍是 `M`（已修改未提交），Sprint 1 的"完成"声明过早 |
| 主题色 + CSS 变量 + Semi ConfigProvider | `metaplatform-frontend/packages/shared/src/components/flow/flowgram-demo/editor.tsx` + `theme-injector.ts` | 命名/落点正确，但**功能分散在 4 处**（editor.tsx、theme-injector.ts、index.css、flowgram-theme.css），耦合度待收敛 |
| 全屏编辑 + Fullscreen API + Esc 退出 | 在 `flowgram-editor.tsx` 中可见 | OK |
| Sprint 2 ~ 4：free-layout / form-materials / group-plugin / i18n-plugin | 仍为 `[ ]` 待启动 | 与计划一致 |
| 阶段 R2~R5：服务化骨架 / Nacos / Java 重写 / MCP/A2A 协议层 | DeerFlow 相关代码（adapter / orchestrator / properties / exception）均**未提交**，只有 workflow 文档（`2026-07-26-ontology-native-deerflow-*`）提交 | §17.10 收尾宣称"测试通过"，但**生产代码改动还在工作树里**——这与 §0.1 "不得以'目录存在/接口存在'代替端到端完成"自相矛盾 |

**问题**：大量"宣布已完成"的章节对应代码**仍在未跟踪区**，评审时无法用 git 历史验证；建议把这些工作先按逻辑切片提交（feature/fix 分支分批合入），再宣称状态。

---

## 2. P0 级风险（必须立刻处理）

### 2.1 框架类影子化 — **绝不允许**
**位置**：`TECH-AGENT/src/main/java/org/springframework/boot/EnvironmentPostProcessor.java`
```java
package org.springframework.boot;
public interface EnvironmentPostProcessor extends org.springframework.boot.env.EnvironmentPostProcessor {}
```
**问题**：在项目源码中**覆盖 Spring Boot 自身的同名接口**，会与框架接口争夺 classloader，且对 Spring Boot 升级极度脆弱（升级后接口签名变化将导致静默失败或启动错误）。这违反了 Spring 自身 SPI 设计的初衷（用户实现应位于 `META-INF/spring.factories` / `spring.application.json` 的 `EnvironmentPostProcessor` 配置项下）。
**结论**：必须删除该文件，改用 Spring Boot 官方机制（`EnvironmentPostProcessor` Bean 注册）。

### 2.2 全局禁用 Spring Security
**位置**：`TECH-AGENT/src/main/java/com/metaplatform/agent/security/SecurityConfig.java`
```java
@Configuration @Primary
@SpringBootApplication(exclude = { SecurityAutoConfiguration.class, ManagementWebSecurityAutoConfiguration.class })
public class SecurityConfig {}
```
**问题**：
1. 在 `@Configuration` 类上挂 `@SpringBootApplication` 是反模式——主类 `AgentApplication` 已是 `@SpringBootApplication`，会触发双重扫描/冲突。
2. 注释写明"为 acceptance harness 关闭"，但**整个模块全部关闭了 Security 与 Management 端点的鉴权**，超出 harness 范围。`/api/v1/agent/runs` 等生产接口也失去保护。
3. 控制器层的 `NativeRuntimeController` 又自带"硬编码 `tenant-default` 放行"逻辑，进一步把安全隐患暴露在代码中。

**结论**：必须 (a) 删除或重写 SecurityConfig，遵循 `TECH-IAM` 的 JWT 过滤器；(b) 移除"tenant-default 放行"硬编码分支。

### 2.3 包路径与目录名不一致
**位置**：
- `TECH-AGENT/src/main/java/com/metaplatform/agent/native/` 目录下三个 `.java`（`NativeAgentRuntime.java`、`NativeRunRequest.java`、`NativeRuntimeController.java`）声明：
  ```java
  package com.metaplatform.agent.native_;
  ```
- 但目录名是 `native/`（无下划线）。
- 测试目录 `TECH-AGENT/src/test/java/com/metaplatform/agent/native_/`（有下划线）才与包声明一致。

**问题**：
- IDE / Maven 编译在不同严格度下行为不一致（`maven-compiler-plugin` 在 `failOnWarning=true` 时会拒绝非标准目录）。
- Spring `@ComponentScan(basePackages = "com.metaplatform.agent")` 会扫描 `native` 与 `native_` 两个子包，但 class 文件落盘路径由包声明决定，行为会与运行期期望漂移。
- 测试目录与主目录结构错位，意味着 IDEA 的"打开声明"跳转可能直接失败。

**结论**：统一为 `com.metaplatform.agent.native`（建议方案）或修正目录名为 `native_`。

### 2.4 工作树存在巨大未提交体量
**数字**：266 修改 + 86 未跟踪 + **100+ 个文件 `LF will be replaced by CRLF`** 警告。

**问题**：
- `TECH-AGENT/src/main/java/...` 下**所有 Java 源码**都是 `M`，意味着评审既看不到 diff，也没有 commit message。
- 上百文件出现 LF→CRLF 提示，说明 `.gitattributes` / `.gitconfig core.autocrlf` 与本机不一致，会导致下一次 `git checkout` 或提交时出现大量噪音。
- 上线前必须把这些改动收敛为可独立合并的提交，并显式选择换行策略。

---

## 3. P1 级问题（应在下个迭代修复）

### 3.1 前端零单元测试
**数字**：9 个 apps（apphub / arch / dashboard / dw / kb / mcphub / ontstudio / portal / superai）+ `packages/shared` 下：
- 无 `*.test.ts(x)` / `*.spec.ts(x)`
- 无 `vitest.config.*` / `jest.config.*`

CLAUDE.md 把"测试"列为关键技术栈（JUnit 5 + Mockito + Testcontainers），但只覆盖后端。前端是项目中实际拥有业务复杂度最高的部分（FlowGram 编辑器、画布、节点拖拽、Copilot 抽屉、SSE 重连），缺测试意味着每次重构都只能靠人工截图验证（`verify-*.png` 数量也说明这一点）。

**建议**：至少为
- `useAgentRunEvents`（SSE 重连 gap 检测 + 命名事件）
- `ClaimRenderer` / `EvidenceRenderer`（关键 UI 组件）
- `ScrollbarAutoHide`（副作用密集）
- `AdminConfigPage` / `AdminPermissionsPage`（表单 + 树 + CRUD）

四个高 ROI 起点补 vitest 单测。

### 3.2 `apps/kb` 版本偏离 CLAUDE.md 基线

| 维度 | 其它 8 个 apps | `apps/kb` |
|---|---|---|
| React | ^19.0.0 | **^18.3.0** |
| antd | ^6.0.0 | **^5.21.0** |
| TypeScript | ~5.7.0 | **^5.5.0** |
| Vite | ^6.4.3 | **^5.4.0** |
| `@mate/shared` | workspace:* | workspace:* |

`apps/kb` 文件夹只有 `index.html / package.json / tsconfig.json / vite.config.ts` 4 个文件，**没有任何页面源码**（除了 `src/App.tsx`、`src/pages/KbListPage.tsx`、`src/pages/SearchTestPage.tsx`）。即使它作为一个独立 demo 也应该统一技术栈版本，否则 pnpm 提升版本时会出现锁文件冲突。

### 3.3 巨型单文件

| 文件 | 大小 | 行数 |
|---|---|---|
| `apps/portal/src/pages/admin/node-render-v2.tsx` | 49,968 B | **1,268 行** |
| `apps/portal/src/pages/admin/AdminComponentsPage.tsx` | 41,872 B | 816 行 |
| `apps/portal/src/pages/admin/AdminPermissionsPage.tsx` | 38,841 B | — |
| `apps/portal/src/pages/admin/AdminConfigPage.tsx` | 37,035 B | — |
| `TECH-AGENT/src/main/java/com/metaplatform/agent/runs/AgentRunEntity.java` | 1,899 B | **单行写完 24 个字段** |

**问题**：
- `node-render-v2.tsx` 单文件里同时定义：节点元数据（36 个）、卡片布局组件、辅助 hook、样式常量；难以单元测试，也难以 PR review。
- `AgentRunEntity` 一个 `@Entity` 类 24 个字段写在一行（缩成一行是为了节省字节数？），违反 Java 风格可读性。
- 多个 admin 页 > 30KB 表明组件树未做拆分。

### 3.4 `RuntimeRouter` 中文字符串硬编码
**位置**：`TECH-AGENT/src/main/java/com/metaplatform/agent/runtime/RuntimeRouter.java`
```java
if (containsAny(msg, "分析", "对比", "总结", "查找", "诊断", "预测", "建议")) return RouteDecision.DEEP;
if (msg.contains("和") && msg.contains("之间")) return RouteDecision.DEEP;
```
**问题**：
1. 路由逻辑仅看**消息长度** + **中文子串**，对英文/方言/混排完全失效。
2. "和" + "之间" 这种粗粒度匹配会误把"和"出现在任一处的句子判为 DEEP。
3. 路由判定会与 i18n 冲突。

**建议**：用 LLM 或语义分类器做 first-pass 路由；或至少把关键词表放到 `application*.yml` 由产品配置。

### 3.5 调试 / 一次性脚本泛滥
`scripts/` 下有 **45+ 个临时脚本**，包括：
- `fix_*.py` × 33（`fix_mcp_external.py` ~ `fix_mcp_ext13.py`、`fix_hql_all.py` ~ `fix_hql_all4.py` 等）
- `__probe_*.cjs` × 6（`__probe_a.cjs` / `__probe_crlf.cjs` / `__probe_disp.cjs` 等）
- `__fix_complete_test.cjs`、`__au_patch.cjs`、`__list.cjs`

这些脚本体现的是开发期"批处理改源码"的痕迹（`fix_all_flyway.py` 直接改 `application-dev.yml` 关闭 Flyway）。一旦这些脚本被遗留在 repo 中：
- 后续开发者会困惑"为什么 `flyway.enabled: false`"
- PR diff 之外的真实改写路径不可追溯

**建议**：保留 `start-*.ps1`、`restart-*.ps1`、`verify-*.ps1`、`repack-*.ps1` 等运营脚本；其它 `fix_/__probe_/` 全部纳入 `.gitignore` 或移到 `scripts/_local/`（不提交）。

### 3.6 DLQ 双状态潜在漂移
**位置**：`TECH-AGENT/src/main/java/com/metaplatform/agent/middleware/ActionRouteDlqService.java`
- 同时维护内存 `CopyOnWriteArrayList<FailedRoute> pending` + DB `ActionRouteDlqRepository`。
- `getPending()` 优先读 DB；`enqueue()` 同时写两边；`retry()` 把内存 entry `remove` 但 DB 通过 `markResolved()` 标记。
- `findById(long id)` 在内存线性扫描（O(n)）。
- `metrics` 字段被声明为可空但**没有注入路径**——`recordEnqueue()` 等调用始终不会触发。

**问题**：
- 进程重启后，内存 pending 丢失；DB 端 `retryCount=0` 但 `resolvedAt=null` 的数据读不到（因为依赖内存镜像，`repository.findAll()` 在测试中是 mock 注入）。
- 真正的运维场景中，`repository.findAll()` 会返回大量陈旧记录，`getPending()` 过滤逻辑失效。

### 3.7 控制器层重复 + 路径不一致
- `AgentRunController#events`：`GET /agent/runs/{runId}/events`（**没有** `/api/v1` 前缀）
- `AgentStreamController#stream`：`GET /api/v1/agent/run/stream`

两套 SSE 端点共存（注释说明是"前端兼容别名"），但前者路径前缀不一致会与 `TECH-GW` 网关路由规则产生歧义；同时长连接复用、前端 SSE 实现只能选其一。

### 3.8 LLM ↔ 系统用魔法字符串通讯
`AgentRunService.triggerAuthoringIfNeeded()`：
```java
if (!answer.contains("@candidates") && !answer.contains("@kb-extract")) return;
```
这是把"模型输出文本中的魔法字符串"作为下游触发条件——脆弱、不可观测（无法定位是哪个工具产生的标记）、也无法被权限/审计拦截。CLAUDE.md 第 §3.2 节明确写"用户上传内容、选中文本和外部文档均标记为不可信输入"，但这里又把 LLM 输出文本当作可信任的协议触发器。

---

## 4. P2 级问题（建议修复）

### 4.1 `flowgram-editor.tsx` 的 DOM 选择器脆弱
```ts
const pg = document.querySelector<HTMLElement>('.acp-flow-section .gedit-playground, .acp-dropzone .gedit-playground');
const BOUNDS = { x: 40, y: 0, w: 1380, h: 420 };
```
使用硬编码 CSS 类名 + magic 数字做视口 fit。FlowGram 升级或容器类名变化会直接破坏。同时存在 `onInit` 与 `onAllLayersRendered` 两段**几乎相同的 fitView 逻辑**。

### 4.2 CLAUDE.md / agent.md 编码乱码
两份主文档在 PowerShell / GitHub 渲染时出现"鏈\xef\xbf\xbd\xef\xbf\xbd枃浠"等乱码，疑似 GB2312 / UTF-8 双重编码残留。建议统一仓库中所有文档为 UTF-8（无 BOM）。

### 4.3 `TECH-AGENT/TECH-AGENT/` 空嵌套目录
`TECH-AGENT/TECH-AGENT/src/test/java/com/metaplatform/agent/deerflow/` 是一层无内容的嵌套目录，与正确路径重复——可能是复制粘贴时漏了清理。

### 4.4 Spring `@Configuration` 滥用 `@SpringBootApplication`
主类 `AgentApplication` 已经声明 `@SpringBootApplication(scanBasePackages = {"com.metaplatform.agent"})`，但 `SecurityConfig` 又挂了一遍。会导致 `ComponentScan` / `AutoConfiguration` 行为不可预期。

### 4.5 `application-dev.yml` 被脚本批量改写
`scripts/fix_all_flyway.py` 直接 `flyway.enabled: true → false`，目的是"临时让本地 dev 启动起来"。这种绕过 Flyway 的做法应改为"profile 切换"或"baseline-on-migrate"，否则 `mvn test` 行为会和生产不一致。

### 4.6 `Authorization` 缺失的"Acceptance 模式"
`DeerFlowAdapter`、`NativeLlmToolLoopService` 等都基于"open 内部调用"假设；如未来加 `JWT` 鉴权，控制器层需要系统改造。建议提前规划"Acceptance profile" 与"Production profile" 的差异声明。

### 4.7 单行控制器类
`NativeRuntimeController.java` 整类缩在一行里写完（58 行 → 一行），可读性差。

---

## 5. 项目亮点

| 项 | 评价 |
|---|---|
| §17 自检表（10/10 DONE） | 自检粒度详细（每条都引用 commit、文件、测试用例），值得肯定 |
| `WfeApprovalReplayDrillTest` | 真实 5 个中间件串联 + Mockito 注入；演练 WFE down → recover → DLQ drain 闭环，质素高 |
| `DeerFlowAdapterContractTest` / `DeerFlowAdapterRealGatewayIT` | 用 `com.sun.net.httpserver.HttpServer` 起 stub 网关做合约测试，方法论正确 |
| `RunEventReplayContractTest` | seq 单调 + afterSeq 排他 + tenant 隔离三项一次覆盖 |
| `MigrationDirectoryAuditTest` | 防止 V 文件重复提交，与 `68e91fb7` 的 V1 冲突修复配套 |
| `TokenBudgetEnforcer` | 入参 / 出参 / 越界处理都规范；单元测试 10 个用例覆盖 |
| `docs/superpowers/specs/2026-07-27-openviking-future-architecture-candidate.md` | 未来架构候选文档遵循"非侵入 + 可降级 + Feature Flag"原则，方向成熟 |
| `FlowgramTheme` 主题色与 `--g-*` 变量 | 与项目 token 体系打通，可维护性好 |
| 跨域 Grounding + `InteractionContextProvider` | 前后端对"页面上下文注入 LLM"契约达成一致 |
| Storybook Demo (`StorybookDemo.tsx`) | 提供本地预览 |

---

## 6. 关键决策建议（按风险×收益排序）

| 序号 | 行动 | 影响面 | 估时 |
|---|---|---|---|
| 1 | 删除 `org.springframework.boot.EnvironmentPostProcessor` 文件，按 Spring 官方机制重新实现 | 全模块 | 0.5 天 |
| 2 | 重写 `SecurityConfig`：用 `TECH-IAM` JWT 过滤器替代；移除 `tenant-default` 硬编码放行 | 全模块 | 2 天 |
| 3 | 把工作树中 266 个修改按 feature 切片合并；统一 LF / CRLF；`.gitattributes` 显式声明 | 工程基线 | 1 天 |
| 4 | 修正 `native/` 目录与 `native_` 包声明的对齐 | TECH-AGENT 编译 | 0.5 天 |
| 5 | `apps/kb` 升版到 React 19 / antd 6 / TS 5.7 / Vite 6 | 前端 monorepo | 1 天 |
| 6 | 引入 vitest，至少补 4 个核心组件/hook 单测 | 前端质量 | 2 天 |
| 7 | `RuntimeRouter` 改为基于"消息长度 + intent classifier"或外部配置 | TECH-AGENT | 1 天 |
| 8 | 清理 `scripts/` 下 45+ 一次性脚本到 `.gitignore` 或 `_local/` | 仓库卫生 | 0.5 天 |
| 9 | DLQ 统一为 DB 单数据源；移除内存 `pending` 镜像 | TECH-AGENT 运维 | 1 天 |
| 10 | `triggerAuthoringIfNeeded` 改为结构化 RAG 触发协议（候选事实 JSON / Tool 返回值），避免 LLM 输出做协议 | TECH-AGENT | 1 天 |

---

## 7. 一句话结论

> 这一轮把"DeerFlow 收尾 + FlowGram 落地"两大主线推到了源码级完成度，但**关键安全 / 工程化反模式**（Spring 类影子化、Security 全局关闭、包路径不一致、上百文件未提交）使得当前 main 分支**不适合合并到受保护主干**。建议优先处理 §2 的 4 项 P0 风险，并按 §6 的清单系统化推进。

---

## 附录 A：评审覆盖范围明细

### A.1 后端模块（按文件 / 测试数量）

| 模块 | 源码（最近更新） | 测试 | 备注 |
|---|---|---|---|
| TECH-AGENT | ~210 文件修改（最大改动区） | 38 个 Test.java | 本轮所有改动核心 |
| TECH-A2A | 2 文件 | 0 | API key + dev 配置 |
| TECH-DATA | 2 文件 | 1 | — |
| TECH-MCP | 6 文件 | 32 | 数量最多 |
| TECH-RAG | 6 文件 | 2 | RAG 闭环代码基本完成 |
| TECH-OBS | 1 文件 | 15 | — |
| TECH-LLMGW | 0（已固化在 HEAD） | 2 | SpringAiLlmProvider 真实实现 |
| TECH-WFE | 0（已固化在 HEAD） | 18 | 审批桥代码已合入 |
| TECH-IAM | 0 | 21 | 权限服务稳定 |
| TECH-ONT | 0 | 17 | Object / Metric / Schema 已合入 |
| TECH-EA | 0 | 36 | 数字员工（历史模块） |
| TECH-MSG | 0 | 11 | Outbox / 事件路由稳定 |
| TECH-GW | 0 | 9 | 网关 |
| TECH-RULE | 0 | 9 | 规则引擎 |

**合计**：后端测试 225 个。

### A.2 前端模块

| app | 页面文件数 | 是否使用最新基线 |
|---|---|---|
| portal | 多（含 admin/components 画布） | ✅ |
| apphub | 多 | ✅ |
| arch | 多 | ✅ |
| dashboard | 多 | ✅ |
| dw | 多（含 CustomerCopilot / OnboardingDraft） | ✅ |
| kb | 仅 2 页 + App.tsx | ❌ React 18 / antd 5 |
| mcphub | 多 | ✅ |
| ontstudio | —（空目录） | — |
| superai | 多（含 AgentChatPanel / ClaimRenderer / EvidenceRenderer / useAgentStream / useAgentRunEvents） | ✅ |

**合计**：前端单元测试 **0 个**（无 vitest.config / 无 jest.config / 无 *.test.ts(x)）。

### A.3 关键新增/修改文件清单（节选）

后端（未提交）：
- `TECH-AGENT/src/main/java/com/metaplatform/agent/deerflow/DeerFlow{Adapter,Properties,RunOrchestrator,Exception}.java`
- `TECH-AGENT/src/main/java/com/metaplatform/agent/runtime/{RuntimeRouter,NativeGraphRuntimeService,NativeLlmToolLoopService,NativeRuntimeEventPublisher,NativeToolExecutionService,UnifiedRuntimeResponse}.java`
- `TECH-AGENT/src/main/java/com/metaplatform/agent/native/{NativeAgentRuntime,NativeRunRequest,NativeRuntimeController}.java`（**包路径与目录不一致**）
- `TECH-AGENT/src/main/java/com/metaplatform/agent/security/SecurityConfig.java`（**全局禁用 Spring Security**）
- `TECH-AGENT/src/main/java/org/springframework/boot/EnvironmentPostProcessor.java`（**影子化 Spring 框架类**）
- `TECH-AGENT/src/main/resources/db/migration/tech-agent/V{1..10}__*.sql`（untracked）

前端（未提交）：
- `metaplatform-frontend/apps/portal/src/pages/admin/{flowgram-editor.tsx,node-render-v2.tsx,custom-base-node.tsx}`
- `metaplatform-frontend/packages/shared/src/components/ScrollbarAutoHide.tsx`
- `metaplatform-frontend/apps/superai/src/hooks/useAgentRunEvents.ts`

脚本（未提交，不应保留）：
- `scripts/fix_*.py` × 33
- `scripts/__probe_*.cjs` × 6
- `scripts/__au_patch.cjs`、`__fix_complete_test.cjs`、`__list.cjs`

---

## 附录 B：评审方法

- 工具：Codex CLI（`MiniMax-M3`）、PowerShell 5.1、git
- 资料：CLAUDE.md、`docs/superpowers/specs/2026-07-26-ontology-native-deerflow-final-delivery-plan.md`、HEAD 提交 `772265e4` 与之前 30 个 commit、`git status --short`、`git diff --stat`、源码逐文件阅读
- 时间：2026-07-27
- 仅审查，未修改任何代码；本文件为审查报告存档，待用户后续依据 §6 清单修复。