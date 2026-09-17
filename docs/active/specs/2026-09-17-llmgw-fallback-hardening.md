# llmgw stub-fallback 加固（批次定义）

> 日期：2026-09-17 · 状态：**待执行**
> 上游：`docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §5.3 / §6
> 触发：2.0 验收时发现「员工产出会间歇性变成回显，而 run 仍报成功」

---

## 1. 一句话

llmgw 在上游不可用时**会把输入原样抄回来**冒充答复（`[stub-fallback] ... Echo: ...`）。
Agent 产品层的员工拿到这种产出时 `status` 仍是 `ok`，于是「假回执」从后门回来了
——**这正是 1.0 立项时要消灭的东西**，只是这次的成因不是缺配置。

## 2. 查证过的事实（别再重新推导）

| # | 事实 | 出处 |
| --- | --- | --- |
| 1 | 回显有**两个**来源：① 请求没带 `base_url`/`api_key` ② **上游 30s 超时** | 本轮实测（2.0 验收 §5.3） |
| 2 | 本机 provider **是配好的**（`default_active=ark` / `glm-5.3-flash` / `enabled=true`），直连 llmgw 8s 拿真实答案 | 同上 |
| 3 | 上游超时写死在 `RealOpenAIProvider`：`timeout: float = 30.0`，**没有任何环境变量可配** | `providers/real_openai_provider.py:64` |
| 4 | `glm-5.3-flash` 是 **reasoning 模型**（实测一次 390 reasoning / 57 content tokens），prompt 一大就顶 30s | 本轮实测 |
| 5 | 回显只在**非生产** profile 可能发生：`self._allow_fallback = not is_production_profile() and ...` | `providers/real_openai_provider.py:71` |
| 6 | 路由层还叠了一层：`allow_fallback = not is_production_profile() and not req.tools` —— **带 tools 的调用永不回显**，所以只有那次「不带工具的收尾纯文本调用」会中招 | `api/routes.py`（`custom`/`openai` 分支） |
| 7 | 回显正文由 provider 拼：`f"[stub-fallback] OpenAI unavailable. Echo: {last_user[:80]}"` | `providers/real_openai_provider.py:46`、`anthropic.py:44` |

**第 5、6 条决定了本批的定性**：硬规则 #5（Production profile 禁止 fallback）**已经**
把生产挡住了——`is_production_profile()` 为真时回显根本不开。所以这**不是生产安全洞**，
而是 **dev 环境保真度**问题：在本机跑，你分不出"模型答了"和"把指令抄回来"。

## 3. 要改的两件

### 3.1 上游超时可配（并给 reasoning 模型留够）

`30.0` 是给普通对话写的数；reasoning 模型 + 大 prompt 天然更慢。做成可配
（环境变量，按 provider 或全局），并**把默认值调到一个 reasoning 模型够用的数**。
不改语义——只是把"超时多久算失败"从写死变成可调。

### 3.2 员工路径**不再接受回显式 fallback**

这是本批的重点。当调用方是 Agent 产品层时，**宁可让那次调用失败**（员工 `status=error`
/ 整轮失败），也**不要**给一个看起来像结论的假回执——假回执是 1.0 立项时要消灭的东西，
它比"失败"危险得多。

**设计选择（三选一，执行前先定）**：

| 方案 | 做法 | 取舍 |
| --- | --- | --- |
| **A（推荐）** | llmgw 请求体加**可选**字段 `allow_stub_fallback`（默认 `true` 保持兼容）；agent-team 侧发 **`false`** | 改动最小、语义清晰、不影响其它调用方；代价是**契约要加一个可选字段**（OpenAPI + 可能进 `REQUIREMENT-MATRIX.yaml`） |
| B | llmgw 全局关掉回显（一律 raise） | 最彻底，但会改掉**所有**非生产调用方的既有行为（谁还在依赖它降级要先查清） |
| C | 只在 agent-team 侧识别 `[stub-fallback]` 并判该员工失败 | 不动契约、不碰 llmgw；但**治标**——其它调用方照样会被回显骗，且回显仍在网络上传 |

**注意**：C 只覆盖"我们认出回显"这一层，**不覆盖"回显仍会被产生"**。前端已做的
如实标注（2.0 那条）就是 C 的一部分——本批若选 A，前端标注仍然保留（双保险）。

## 4. 判据

| # | 判据 | 怎么验 |
| --- | --- | --- |
| 1 | 上游超时**可配**，且默认值下 reasoning 模型那次调用能跑完 | 起一轮真实 run，llmgw 日志里**没有** `llmgw.real.openai.timeout` |
| 2 | Agent 产品层的员工调用**拿不到回显**：上游失败时该员工 `status=error`，**产出里不含** `[stub-fallback]` | 构造一次上游失败（断网/错 base_url），断言 `status != ok` 且正文无标记 |
| 3 | **不改其它调用方的既有行为**（默认仍是可回显） | 不带新字段的调用，行为与改动前逐字相同（回归用例） |
| 4 | 非生产 profile 的门没有松：`is_production_profile()` 时仍一律不回显 | 现有用例保持绿 |

## 5. 不做

- **不新增 operationId**（若选 A，只是在既有请求体上加一个可选字段）。
- **不改前端**——如实标注已在 2.0 交付，本批不动。
- **不动硬规则 #5**——它是对的，本批是在它之上补"dev 也别骗人"。
- **不引入重试策略变更**——1.5 的 `RetryPolicy` 只包住员工运行时那一次调用，本次不碰。

## 6. 开工前必读

- 踩坑卡 `2026-09-16-agent-product-layer-env-facts.md` §4（回显的两个来源 + 怎么读 llmgw 结构化日志）
- 2.0 验收 `AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §5.3（完整查证记录）
