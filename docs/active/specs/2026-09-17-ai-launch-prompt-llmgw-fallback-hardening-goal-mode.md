# GOAL 模式启动提示词 —— llmgw stub-fallback 加固

> **必读**：`2026-09-17-llmgw-fallback-hardening.md`（批次定义，含**已查证的事实表**）、
> `2026-09-16-agent-product-layer-env-facts.md` §4（踩坑卡）、
> `AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §5.3（完整查证记录）

你是自主执行工程师。**先读批次定义 §2 的事实表**——里面每一条都是实测过的，
别重新推导，也别推翻。做完跑验证并 commit，最后输出报告。

## GOAL

让 Agent 产品层的员工**拿不到假回执**：上游不可用时宁可该员工失败，也不要一个
看起来像结论的 `[stub-fallback]` 回显；同时把写死的 30s 上游超时做成可配。

## 锁死决策

- **先定性再动手**：这**不是生产安全洞**——硬规则 #5 已经用
  `is_production_profile()` 把生产挡住了（回显只在非生产开）。所以本批治的是
  **dev 保真度**：在本机你分不出"模型答了"和"把指令抄回来"。别把它写成安全问题。
- **不改默认行为**：不带新字段的调用方，行为必须与改动前**逐字相同**（判据 3）。
  其它服务还在用 llmgw，别顺手把它们降级能力关掉。
- **契约先行**：若选批次定义 §3.2 的**方案 A**（推荐），先改
  `contracts/openapi/services/llmgw.yaml`，再写失败测试，再改代码。
- **前端别动**：如实标注已在 2.0 交付（面板「回显 n/m」+ 详情里的警告条），本批不碰。

## 硬约束

不绕过 13 硬规则；只用 `mate-platform-backend/.venv`（首跑记基线，此后不得低于）；
代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；从 main 开
`feat/llmgw-fallback-hardening`；中文加 `PYTHONIOENCODING=utf-8`。
**两个钩子**：`detect-private-key` 比 gitleaks 更宽（注释里也不能有私钥头连写）；
`forbid_skip_tests` 禁 `skip`/`skipif`/`xfail`，放行 `importorskip`。

## 任务

### 任务 1 · 上游超时可配

`providers/real_openai_provider.py:64` 的 `timeout: float = 30.0` 是写死的，且全仓
**没有任何环境变量**能改它。做成可配，并**把默认值调到 reasoning 模型够用**
（先量：本地 `glm-5.3-flash` + 员工那种大 prompt 实测要几秒，按实测留余量）。

**判据**：起一轮真实 run，llmgw 日志里 `llmgw.real.openai.timeout` **不出现**；
另有一条单测钉住"环境变量能改到生效值"。

### 任务 2 · 员工路径禁回显

按批次定义 §3.2 **方案 A** 实现：llmgw 请求体加**可选** `allow_stub_fallback`
（默认 `true`）；agent-team 侧发 `false`。

**判据**：

- 上游失败时，该员工 `status=error`（不是 ok），且产出正文**不含** `[stub-fallback]`；
- 不带该字段的调用，行为与改动前**逐字相同**（回归用例）；
- `is_production_profile()` 为真时仍一律不回显（既有用例保持绿）。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-llmgw/tests packages/mate-tech-agent-team/tests packages/mate-clients/tests -q
```

**先记基线，此后不得低于。**
另需**真实跑一轮**：起一个 agent-team run，确认 llmgw 日志无 timeout、员工产出无回显。

## 报告

改动 + 回归数字 + commits + PR + **发现但未做的建议**。

## 边界

不新增 operationId（只在既有请求体加可选字段）；不改硬规则 #5；不动前端；
不引入重试策略变更；secret 不进 git。
