# ADR-0063：Function 源码解析与执行接线（GOVERN-05 收口）

> **状态**：**Accepted（已实施）** —— 核心决策 D1/D2/D3 于 2026-09-14 拍板，
> §6 的 **S1–S5 已全部落地**，部署态 e2e 已跑通（`propose→confirm→execute` 200 + 属性真实回写）。
> 剩余 §7 三项为后续优化项，不阻塞本 ADR 生效。
> **日期**：2026-09-14
> **作者**：Claude (Sonnet 5) + 用户协作
> **关联 ADR**：ADR-0040（数字员工沙箱架构 · Function Sandbox L2）、ADR-0044（assisted action · HITL 唯一写路径）、ADR-0021（Kernel 12 基元 · Function 为第 11 基元）
> **关联硬规则**：硬规则 3（无 tenant 上下文不访问 repository）、硬规则 5（Production profile 禁止 fallback）、硬规则 9（审计/指标/trace）、硬规则 12（Secret 不进 git）
> **触发**：`docs/active/specs/2026-09-14-ontology-data-validation-report.md` §5 F1

---

## 1. 背景

### 1.1 现象（2026-09-14 实测）

部署态本体服务（`mate-tech-ont`，`KERNEL_BACKEND=pg`）的 `ActionType.apply`
**不执行业务逻辑**：调用返回 200、发出 `audit_log` 与 outbox 事件，但目标
实例的业务属性**零写入**。

### 1.2 根因

`pg_repo.upsert_function` 对任何 `inline://` 前缀的 `source_ref` 一律注册
**内置恒等函数**：

```python
# pg_repo.py:55
_PG_DEFAULT_INLINE_FN = "def main(target, params):\n    return params\n"
# pg_repo.py:58
_PG_INLINE_FUNCTIONS: dict[str, str] = {}      # 部署态为空字典
# pg_repo.py:2383-2393
if f.source_ref.startswith("inline://"):
    self._function_resolver.register(
        f.language, f.source_ref,
        _PG_INLINE_FUNCTIONS.get(f.source_ref, _PG_DEFAULT_INLINE_FN),   # ← 恒等兜底
    )
```

`ont_function` 表（`pg_repo.py:500`）**只存 `source_ref` 指针，不存源码**；
启动时 `main.py:80` 按 `FUNCTION_BACKEND=memory`（默认）注入
`_SimplePythonExecutor`。二者叠加的结果是：**只有函数签名被持久化，函数体
无从获取**，`apply` 便把 `parameters` 原样回显当作"结果"。

### 1.3 第二处静默兜底

`action/engine.py:412` 另有一处兜底：

```python
# GOVERN-05: 默认 fallback —— 没有 invoker/executor 时返回 parameters
# 当作"决策结果"，让 dev/未注册源码的 ActionType 仍可 apply。
function_result = parameters
```

该兜底使"函数未注册"与"函数执行成功但无副作用"在外部**不可区分**，掩盖了 1.2
的缺口（本会话排查时即被误导一次：`execute` 返回 200 却无写入）。

### 1.4 设计意图其实早已写明

`function_resolver.py:33` 的 docstring 明确预告了本 ADR 的方向：

> registry 键：``(language, source_ref)`` —— ``source_ref`` 形如
> ``inline://<rid>``（手动注入）或 ``git:sha-abc123``（**GOVERN-05+1 拉**）

即 Git 来源是**既定意图**，只是 `GOVERN-05+1` 从未落地。

### 1.5 现状盘点

| 组件 | 现状 |
| --- | --- |
| `FunctionResolver` Protocol | 已定义（`function_resolver.py:24`），仅 `InMemoryFunctionResolver` 一个实现 |
| 执行器 | `_SimplePythonExecutor` / `SubprocessExecutor` / `K8sJobExecutor`（`sandbox/k8s.py`）均已实现 |
| Function 元数据 | `ont_function` 表持久化 rid/language/version/**source_ref**/signatures |
| 版本演进 | `ont_function_version` + `ont_function_alias`（G23）已具备 |
| Sandbox 分级 | ADR-0040 已定：L2 = K8s Job/Pod（prod 唯一允许），dev 双轨 `SANDBOX_BACKEND=subprocess` |
| prod 守门 | `require_real_dependency("FUNCTION_BACKEND", backend != "memory")`（`main.py:76`）—— **prod 已禁止 memory 后端** |

### 1.6 作用域澄清：三条正交的轴（2026-09-14 评审澄清）

讨论 D1 时曾出现一个混淆：**"源码从 Action 编排来"**。需要把三条轴分开——

| 轴 | 回答什么 | 载体 | 承载源码？ |
| --- | --- | --- | --- |
| **编排轴** | 「哪些 Action、什么顺序、什么分支、何时等人」 | Workflow（BPMN-lite → 后续 Temporal，ADR-0061），节点持 `action_rid` **指针** | **否** |
| **声明式轴** | 「Action 要改什么」 | `ActionType.declarative_edits` → EditSet（`set_property`/`create_object`/`delete_object`/`add_link`/`remove_link`），单事务原子 | **否** |
| **代码轴** | 「Action 内部那段计算是什么代码」 | `ActionType.function_ref` → Function（12 基元之 11） | **是** ← **本 ADR 只管这条** |

证据：`workflow.py:167-177` 的 ACTION 节点只携带 `node.action_rid`，执行时调
`actions.apply(action_rid=node.action_rid, function_ref=node.action_rid, ...)`——
源码不经过编排层。`edit_set.py` 开头写明两条执行路径**并存**：
「ActionType 声明 `declarative_edits` 时走本模块……否则走 legacy[function]」。

**结论**：本 ADR 的作用域是**代码轴**，且应把 Function 定位为
**「声明式表达不了的复杂计算的例外通道」**，而非业务逻辑的主干。
（SOP-Bench 的评分公式/危险品分级属真计算，声明式表达不了，正是这一层要承载的。）

### 1.7 关联缺口：flow 路径的 `function_ref` 是占位

`workflow.py:176` 传的是 `function_ref=node.action_rid`（注释原文：
「同 rid 作为 function 占位」）。即 **flow 路径并未解析 ActionType 真正声明的
`function_ref`**，而是拿 action rid 顶上。该路径当前依赖 §2.2 的静默兜底才能
"跑通"（回显 parameters）——删除兜底后此路径会直接暴露。本 ADR 一并纳入范围。

---

## 2. 决策

> **本节 D1/D2/D3 已于 2026-09-14 由决策者拍板**（见 §8 决策记录）。

**作用域（D1）**：本 ADR 只处理 §1.6 的**代码轴**，且把 Function 定位为
**声明式表达不了的复杂计算的例外通道**——编排层（Workflow）与声明式层
（`declarative_edits`）都不承载源码，不在本 ADR 范围内。

**在代码轴内部**：源码以「不可变的版本化来源」按 `source_ref` scheme 解析；
移除一切静默兜底；解析失败一律 fail-fast。**Git 为第一公民来源**，inline
仅保留给 dev/test profile。

### 2.1 核心决策表

| # | 维度 | 决策 |
| --- | --- | --- |
| **D1** | **主来源** | **Git**：`source_ref = git:<commit-sha>:<repo-relative-path>`，SHA 必须完整 40 位、必须命中仓库（OCI 留待 SANDBOX-02） |
| D1 | 解析器 | 新增 `GitFunctionResolver`（实现既有 Protocol），按 scheme 分派 |
| D1 | 源码不可变性 | 以 **commit SHA** 而非 branch/tag 作为锚点（branch 可移动，破坏可复现性） |
| D1 | inline 通道 | **仅 dev/test profile**；prod profile 拒绝 `inline://`（硬规则 5） |
| D1 | dev 默认实现 | `InMemoryFunctionResolver` 保留，但**必须显式注册**（走 `inline://` 声明的 rid） |
| D1 | 源码注入 | **不开放**「上传任意源码」的 API 端点（安全红线，见 2.3） |
| D1 | 执行路径 | **不变**——仍由 Function Sandbox 执行（ADR-0040 L2）；resolver 只负责"取源码" |
| **D2** | **未注册 function_ref** | **fail-fast**：`apply` 抛 `FunctionNotRegistered`。**一刀切删除**两处静默兜底，**不留** dev 开关 |
| **D2** | 未知 scheme | **fail-fast**：`unknown source_ref scheme: <x>`，不再回落恒等 |
| **D3** | **Git 凭证** | **只读 deploy key**（私有仓库）；凭证遵守硬规则 12 不进 git |
| — | flow 路径 `function_ref` 占位 | 见 §2.6（本次一并修正） |

### 2.2 关键子决策：删除两处静默兜底（D2 = 一刀切）

这是本 ADR **最重要**的一条。**两处兜底直接删除，不留显式开关**
（决策者明确选择 a 方案，不接受 dev 例外开关——避免硬规则 5 的边界被模糊）：

1. `pg_repo.py:2383` 的 `_PG_INLINE_FUNCTIONS.get(ref, _PG_DEFAULT_INLINE_FN)`
   → 未命中即 `raise FunctionNotFoundError`。
2. `engine.py:412` 的 `function_result = parameters`
   → 未注册即 `raise FunctionNotRegistered`。

**理由**：静默兜底把"配置缺陷"伪装成"正常执行"，使失败不可观测。本会话中
`execute` 返回 200 + audit_id + outbox 事件，"看起来成功了"，实际什么都没算
——这类失败比直接报错危险得多。呼应 `sql_compiler` 的同类问题（见修复计划 F4）。

### 2.3 安全红线：不接受经 API 的任意代码执行

**明确否决**「提供 `POST /functions` 带源码 body」的方案。理由：

- 任何能调该端点的人即可在平台内执行任意代码 —— 与 ADR-0040 的沙箱信任模型
  直接冲突（L2 只约束**执行**，不约束**来源**）。
- Function 是 12 基元中唯一"代码宿主"，其**来源**必须可追溯到经过 review 的
  变更（PR → commit SHA），而非运行时上传。

因此：源码**只能**来自受版本控制的仓库（Git）或**已经受控加载**的 inline
（dev/test 进程内注入，不经网络）。

### 2.4 与 ADR-0040 的职责边界

| 关注点 | 归属 | 本次是否变更 |
| --- | --- | --- |
| 源码**来源**与解析 | 本 ADR | ✅ 新增 |
| 源码**执行**（隔离/配额/审计） | ADR-0040 Function Sandbox | ❌ 不变 |
| 每次调用独立实例 / 零网络 / 租户继承 | ADR-0040 §2.2 六条硬要求 | ❌ 不变 |
| prod 执行后端 | `FUNCTION_BACKEND=k8s`（现 `main.py:80-88`） | ❌ 不变 |

### 2.5 顺带澄清：`FUNCTION_BACKEND` 与 `SANDBOX_BACKEND` 语义重叠

现状并存两个命名相近、语义部分重叠的开关：

| 变量 | 位置 | 语义 |
| --- | --- | --- |
| `FUNCTION_BACKEND` | `mate-tech-ont/main.py:75` | ont 服务**注入哪个 FunctionExecutor**（`memory`/`subprocess`/`k8s`） |
| `SANDBOX_BACKEND` | `mate-kernel/sandbox/k8s.py:380` | `K8sSandboxRunner` 的 **transport**（`subprocess`/`k8s`） |

ADR 决策：**保留两个变量但明确层级**——`FUNCTION_BACKEND` 是 ont 服务级的
执行器选择，`SANDBOX_BACKEND` 是其下游 runner 的 transport 选择；文档与
`values.yaml` 注释需写明二者关系，且 **prod profile 必须同时锁定为非 memory /
非 subprocess**。是否合并为单一变量留待 GOVERN-01 后续统一，本 ADR 不强制。

### 2.6 flow 路径必须解析真实 `function_ref`

`workflow.py:176` 当前传 `function_ref=node.action_rid`（占位）。决策：
**flow 引擎在执行 ACTION 节点前，必须先 `get_action_type(node.action_rid)`
取出其声明的 `function_ref`，并用该 rid 调 `apply`**；取不到则 fail-fast。

理由：占位写法使编排路径**绕过** Action 声明的函数——即使 §2.2 删了兜底，
该路径也只会拿到一个不存在的 function_ref 而报错，仍是错的。二者必须一起改，
否则"删兜底"在 flow 路径上表现为"立刻全挂"而非"正确执行"。

---

## 3. 理由

1. **可追溯优于可注入**：SHA 锚点让"某个 Function 当时执行的是什么代码"可被
   审计复现；这与平台的审计基线（硬规则 9）同构。
2. **失败要响**：删除静默兜底后，"Function 没接线"会在第一次调用即暴露，
   而不是伪装成成功。这是本次缺口能隐藏至今的直接原因。
3. **复用既有骨架**：Protocol、三个 Executor、版本表（`ont_function_version`）、
   alias（G23）、prod 守门（`require_real_dependency`）全部已存在，本 ADR 是
   **把预留的接缝做成真**，不是新建设施——与 ADR-0062 的"复用而非新造"同构。
4. **安全边界不放松**：拒绝源码上传端点，把攻击面限制在"仓库提交"这一已有
   review 通道内。

---

## 4. 后果

### 4.1 已接受的限制（须如实说明）

- **本 ADR 不含 OCI 来源**：`ociref://` / image digest 留待 SANDBOX-02。当前
  只有 Git 与 inline 两种 scheme。
- **`ont_function` 表仍不存源码**：源码从 Git 拉取后有进程内缓存（resolver
  registry），但**无源码级审计留痕**（只留 SHA）。是否需要"执行时快照源码"
  另议。
- **Git 凭证**：私有仓库需要只读凭证。凭证来源与轮换不在本 ADR 范围内，
  但必须遵守硬规则 12（不进 git）。

### 4.2 破坏性影响

- **移除静默兜底是 breaking change**：任何当前依赖"未注册函数仍可 apply"的
  dev 流程或测试会失败。需同步清理：
  - `mate-kernel/tests/` 中依赖 `function_result = parameters` 的断言；
  - `mate-tech-ont/tests/` 中依赖恒等兜底的用例；
  - `seed.py` 里 `_function_placeholder` 造的占位 Function（`seed.py:60`，
    被 92/235/411 行复用）需改为显式注册 inline 源码，否则 demo 流程会挂。
- **prod profile 拒绝 `inline://`** 会使现有 `ONT_SEED_DEMO=1` 的 demo 种子
  在 prod 不可用（预期行为：demo 仅 dev）。

### 4.3 被否决的替代方案

| 方案 | 否决理由 |
| --- | --- |
| `POST /functions` 带源码 body（运行时上传） | 等于开放任意代码执行，绕过 review 通道；与 ADR-0040 信任模型冲突 |
| 源码存 PG（`ont_function.source` 列） | 审计上"谁在何时改了源码"不可追溯；且 DB 写权限即代码执行权限，权限模型过宽 |
| OCI image digest 作为唯一来源 | 需要镜像构建/推送流水线，当前不存在；Git 更贴合现有开发流程 |
| branch/tag 作为锚点 | 可移动，破坏可复现性与审计（"当时跑的是哪个 commit"不可答） |
| 保留恒等兜底但加日志告警 | 治标：告警会被忽略，且 `apply` 仍返回 200 假成功；不解决"失败不可观测"的根因 |
| 完全删除 inline、只留 Git | dev/test 与 pytest 会失去快速注入通道（沙箱执行器测试依赖它），收益不足 |

---

## 5. 验证

| 层 | 验证项 |
| --- | --- |
| 单元 | `test_git_resolver_fetches_by_sha`：`git:<sha>:<path>` → 取到正确源码 |
| 单元 | `test_unknown_scheme_fails_fast`：未知 scheme → 明确报错，**不得**恒等回落 |
| 单元 | `test_unregistered_function_ref_raises`：未注册 → `FunctionNotRegistered`（**不得**回显参数） |
| 单元 | `test_prod_profile_rejects_inline`：prod profile 下 `inline://` 被拒（硬规则 5） |
| 回归 | 既有 `mate-kernel/tests` + `mate-tech-ont/tests` 全绿（含清理 4.2 的断言） |
| 端到端 | 用 `scripts/ont-bench/pilot_dangerous_goods.py` 的 `classify-danger` 真逻辑，**经部署态**跑通 `dangerous_goods` 274/274 —— 把本会话的"内核层验证"升级为"平台层验证" |
| 证据 | 产出 `<BATCH>-ACCEPTANCE.md` 段落，更新 `HARD-RULES-MATRIX`（硬规则 5 的落点从"启动守门"扩展到"执行期 fail-fast"） |

---

## 6. 分阶段实施（**S1–S5 已全部落地**，2026-09-14）

| 阶段 | 内容 | 出口 | 状态 |
| --- | --- | --- | --- |
| **S1** | `GitFunctionResolver` 实现 + scheme 分派 + 单测（D3：只读 deploy key） | 按 SHA 取源码并执行 | ✅ 6 测试 |
| **S2** | 删除两处静默兜底（`pg_repo.py` 恒等函数 / `engine.py` 参数回显）+ 清理依赖它们的测试与 seed | fail-fast 生效，测试全绿 | ✅ 22 处连带清理 |
| **S3** | flow 路径解析真实 `function_ref`（`workflow.py:176` 去占位） | 编排路径执行 Action 声明的函数 | ✅ |
| **S4** | prod profile 拒绝 `inline://` | 硬规则 5 覆盖执行期 | ✅ |
| **S5** | 部署态端到端（propose→confirm→execute + 属性回写） | 验收证据落地 | ✅ **已跑通** |

> S2 与 S3 **必须同批**：只删兜底不改 flow 占位，会让编排路径从"静默假成功"
> 变成"立刻全挂"。（实施时确按同批交付。）

### 6.1 实施中新发现（原 ADR 未预见，已一并修复）

| 缺陷 | 说明 |
| --- | --- |
| PG `set_function_executor` 漏注册 | 它只赋值 executor，**从不给已有 Function 注册 `function_ref`**（InMemory 版本有遍历）。启动顺序是 `seed_demo()` → `_inject_function_executor()`，故 seed 创建的函数永远不被 ActionService 认知 → `FunctionNotRegistered`。 |
| seed 回填不彻底 | 已升级为 `inline://` 的行走了 `continue`，只写 `_PG_INLINE_FUNCTIONS` 不调 `upsert_function`，而 **resolver 注册只发生在 upsert 里** → 新进程仍解析不到。 |
| `audit_id` 撞主键 | `engine.py` 用进程内计数器 `audit-<n>`；容器重启后归零 → 撞 `ont_action_audit` 主键 → execute 500。加进程唯一前缀。 |

> 后两条都是**部署后才暴露**的：本地/单测里 executor 与 upsert 的调用顺序不同，掩盖了问题。

---

## 7. 待评审问题（Open Questions）

1. **源码快照**：执行时是否落一份源码快照以供事后审计（vs 只留 SHA）？
2. **缓存失效**：resolver 进程内缓存源码；Function 覆盖（同 rid 新 version）
   后如何失效？是否复用 G23 的 alias 机制？
3. **`FUNCTION_BACKEND` / `SANDBOX_BACKEND` 是否最终合并**（GOVERN-01 统一）？

---

## 8. 决策记录

| 日期 | 决策点 | 结论 | 决策者 |
| --- | --- | --- | --- |
| 2026-09-14 | **D1** 源码来源 | **分层**：编排层 / 声明式层不承载源码；本 ADR 只管**代码轴**，Function 定位为「声明式表达不了的复杂计算的例外通道」。代码轴内部以 **Git SHA** 为第一公民来源，OCI 留待 SANDBOX-02 | 用户 |
| 2026-09-14 | **D2** 静默兜底 | **一刀切删除**，不留 dev 开关（接受 breaking：需同步清理 seed 与相关测试） | 用户 |
| 2026-09-14 | **D3** Git 凭证 | **只读 deploy key** | 用户 |
| 2026-09-14 | 关联缺口 | flow 路径 `function_ref` 占位（§1.7/§2.6）纳入本 ADR 一并修正 | 用户 |

> 评审过程中澄清的一条概念：「源码从 Action 编排来」不成立——编排层只持
> `action_rid` 指针（§1.6）。该澄清已改写进 §1.6，用于防止后续同类混淆。
