# Staging 实机演练报告 — 生产 ARK Key 正式托管 + 本体引擎 UI 收口

> **演练日期**：2026-09-14
> **演练环境**：Windows 10 / Docker Desktop (WSL2) 容器栈 —— 生产安全基线（`LEGACY_LOGIN_COMPAT=false` + `INSECURE_SKIP_SIGNATURE=false` 全服务）
> **演练方式**：Playwright E2E（真实浏览器 + 真实网关 8100 + Keycloak RS256 + 真实 ARK Plan 通道），全程无人值守
> **结论**：**12 / 12 用例通过**；生产 ARK key 已正式托管（IAM 敏感配置，掩码读 / write-only / 服务端解析），真实对话与 embedding 均经托管 key 完成。

---

## 1. 演练范围与结论

| # | 演练项 | 结果 | 证据 |
|---|--------|------|------|
| A | 真实 IAM 登录（admin → RS256 JWT → 工作台） | ✅ | `drill-01-login-ontology-overview.png` |
| B1 | 本体引擎一级 tab 收敛为 8 个（11→8 二轮去重） | ✅ | spec B1 |
| B2 | 类型管理 4 子 tab + 概念建模页宽度撑满（历史 bug：右侧 1/3 空白） | ✅ | `drill-02-type-management-fullwidth.png` |
| B3 | 分析应用三合一子 tab（分析工作台/仪表盘/地图） | ✅ | spec B3 |
| B4 | 旧链接别名落到正确子 tab（`?tab=interfaces`→类型管理/接口契约 等） | ✅ | spec B4 |
| C | AI Provider 页 ARK 托管卡片 + key 掩码不回显 | ✅ | `drill-03-ark-provider-card.png` |
| D1 | 掩码读：`GET /admin/configs` 返回 `***`，响应体无明文 key | ✅ | spec D1 |
| D2 | reveal 拒绝：用户 token + 无服务密钥 → 403 | ✅ | spec D2 |
| D3 | write-only 保存：掩码/空值不覆盖托管 key | ✅ | spec D3（D3 后 E 仍通过 = key 未被破坏） |
| E | **真实 ARK 对话**（glm-5.3-flash，托管 key 服务端解析） | ✅ | spec E（"1+1 equals 2." 实测回包） |
| F | **真实 ARK embedding**（doubao-embedding-vision，384 维真实向量） | ✅ | spec F |
| G | 核心页巡检无未捕获前端错误 | ✅ | spec G |

**测试命令**（可复跑）：

```bash
cd metaplatform-frontend
E2E_BASE_URL=http://localhost:9250 npx playwright test --project=staging-ark-drill
```

---

## 2. 生产 ARK Key 正式托管 — 方案与实现

### 2.1 托管前后对比

| 维度 | 托管前 | 托管后 |
|------|--------|--------|
| key 存放 | `ai.provider.custom.api_key`（明文可读）+ 宿主机 `.env` `ARK_API_KEY`（空值，历史兜底位） | `ai.provider.ark.api_key`（IAM 敏感配置一等公民位，`ai.provider.ark.*` 四件套 + `embedding_model`） |
| 读接口 | `GET /admin/configs` 返回**明文** value（浏览器可取） | 敏感项 `value`/`raw_value` 一律 `***`；`reveal=1` 仅服务密钥放行 |
| 写接口 | 任意值直接覆盖 | write-only：`***`/空串 = 保持原值；审计明细不落明文 |
| 服务端取数 | copilot 以**用户 token 回落**读明文 | 新增 `GET /admin/configs/service-read`（X-Service-Secret 共享密钥守门，仅 `ai.provider.*` 命名空间）；llmgw / copilot 均改走该通道 |
| 探测/获取模型 | 浏览器把明文 key 发给 `/providers/test` | key 为空/掩码时 llmgw **服务端解析**托管 key；浏览器永不下发明文 |
| 默认路由 | `ai.provider.default_active=custom` | `=ark`；copilot 读配置时按 `default_active` 间接寻址（目标未配置完整不切换，保持 legacy 行为） |

### 2.2 安全判定链（实测）

1. 浏览器管理员会话读配置 → `***`（D1 ✅，且响应体无 `sk-*` 形态字符串）。
2. `reveal=1` 无 `X-Service-Secret` → **403**（D2 ✅）；`SERVICE_CLIENT_SECRET` 未配置时 **fail-closed**（单测覆盖）。
3. `service-read` 强制 `prefix=ai.provider.`（其它命名空间如 `branding.*` 不可达，单测覆盖）。
4. 审计日志明细中敏感值以 `***` 记录 before/after（单测覆盖：`sk-real-secret-value` 不出现在审计 JSON）。
5. llmgw/copilot 以服务身份 + 共享密钥取数 → 真实 key 只存在于：IAM DB、后端进程内存、发往 ARK 的 Authorization 头。

### 2.3 关键设计取舍

- **为什么用共享密钥头而不是 client_id 判定**：本 realm 中 IAM 登录签发的用户 token 与服务 client_credentials token 的 `azp` 同为 `metaplatform-backend`（auth.py 与 ServiceIdentity 共用 SERVICE_CLIENT_ID），client_id 无法区分人/机；改用 `X-Service-Secret == SERVICE_CLIENT_SECRET`（hmac.compare_digest 恒时比较）。
- **为什么新增 service-read 而不是给服务 client 加 PLATFORM_ADMIN role**：Keycloak realm 角色映射变更涉及 realm 重建，风险与 tonight 窗口不匹配；共享密钥已在全后端服务注入（硬规则 12 的 SealedSecret 语义），且端点限定了 `ai.provider.*` 只读命名空间。后续可在 Keycloak 侧补 `CONFIG_READER` 角色后回收该通道。
- **探测语义**：custom 通道 `/models` 返回 404 判"可达"（ARK Plan `/api/plan/v3` 不实现 /models，实测如此）；真实可用性由真实对话/embedding 用例证明（E/F ✅）。

### 2.4 单测覆盖（本演练新增）

- IAM：掩码读（value+raw_value）、write-only 保存（掩码/空串保持原值 + 审计不落明文）、reveal 三态（无密钥/错密钥/正确密钥）、service-read（守门 + 命名空间强制 + fail-closed）、ark seed 四件套与 default_active 枚举刷新 —— `test_admin_configs.py` 11 用例。
- llmgw：embedding 服务读取数信封（service-read 平铺结构）×4、custom 404 可达语义 —— `test_embedding_admin_config.py` / `test_provider_test.py`。
- 套件基线：llmgw 全量 ✅、copilot 全量 216 ✅、IAM 全量 ✅。

---

## 3. 本体引擎 UI 收口（第二轮去重）

### 3.1 tab 结构（11 → 8）

| 一级 tab | 子 tab | 变化 |
|----------|--------|------|
| 总览 | — | 模块导航卡 9→7 张，与 8 tab 对齐；原"关系类型/动作类型"独立卡合并进"类型管理"卡（含 对象/关系/动作 计数徽标） |
| 类型管理 | 对象类型 / 关系类型 / 动作类型 / **接口契约** | 接口从一级 tab 并入（Kernel 类型层第 4 基元） |
| 对象数据 | — | — |
| 数据中心 | — | — |
| Action 编排 | — | — |
| 知识图谱 | — | — |
| 治理 | — | — |
| **分析应用** | 分析工作台 / 仪表盘 / 地图 | L6 三件套合并（Quiver/Carbon/Map 对位），全部懒加载 |

### 3.2 附带修复

1. **宽度未拉伸（用户报告）**：`OntologyModelingPage` 主行容器缺 `flex:1 + width:100%`（AIAssistantWorkspace__content 为横向 flex），1600px 视口下右侧约 550px 空白 → 修复后内容行 = 内容区全宽（B2 数值断言：rowW ≥ contentW−8px）。
2. **别名丢子 tab（存量 bug）**：`?tab=relationship-types` 旧逻辑只映射到父 tab，落到默认"对象类型"子页 → `LEGACY_TABS` 复合映射 `{tab, subTab}`，别名精确落位（B4 回归）。
3. **遮挡排查**：8 个 tab + 全部子页经溢出探测（超视口元素扫描）与截图核对，无裁切；知识图谱宽画布为设计内平移区。

---

## 4. 演练中发现并修复的问题（附随发现）

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | llmgw `/chat/real` 全链路 500 | `CooldownManager.check()` 同步调用 redis.asyncio 的 `get()` → 拿到 coroutine 在 `float()` 处 TypeError | check 改 async，调用方 await（`resilience/cooldown.py` + `call.py`），测试 fake redis 同步改 async |
| 2 | mate-auth-service 镜像构建必失败（缓存掩盖） | 上游提交把 Dockerfile 续行符 `\` 后插入了空行/注释行，BuildKit 跨空行拼接指令 → `pip install ... COPY services/` | Dockerfile 残行清理重写（`services/auth-service/Dockerfile`） |
| 3 | 服务 token 400 invalid_scope | 本 realm 服务 client 未注册 `platform.read/write` 自定义 scope | llmgw/copilot 全部 scope 改 env 化默认 `openid`（实测可用） |
| 4 | copilot 服务路径从未真正工作 | 服务 client 无 PLATFORM_ADMIN role，一直靠用户 token 回落 + 旧明文读 | service-read 通道（见 §2.1） |
| 5 | mate-app-a2a 崩溃循环 | 镜像 protobuf 版本早于 Dockerfile 的 `protobuf<6` 修复 | 干净上下文重建镜像 → healthy |
| 6 | AI Provider 页模型桶错位 | 模型保存按归一后 provider（custom）入桶、卡片按原始 id 读 → 自定义/ark 卡片模型列表恒空 | 保存与读取统一原始 id，动态桶懒建 |
| 7 | ARK Plan 探测误报失败 | /models 404 被判不可达 | custom 通道 404 判可达（§2.3） |

---

## 5. staging（kind + helm）状态说明

按 [SPRINT-FINAL-ACCEPTANCE] 与环境约束（WSL2 8GB；Trino+Milvus+kind 不可同驻；当前 dev 栈 + Milvus 常驻），**kind 集群本次未拉起**（WSL 硬重启后 kind 容器未存活，staging release 亦已卸载）。本次"实机演练"在生产安全基线的容器栈（与 staging 同镜像、同协议、同 Keycloak RS256 链路）完成全流量验证。

**staging K8s 演练解锁条件**（不变，供下次窗口执行）：
1. 独立资源窗口（停 dev 栈或停 Milvus）；
2. 预拉镜像（daocloud → kind load：gateway/auth/llmgw/copilot/ont/rag 等 + kube-prometheus-stack 子 chart 镜像）；
3. `infra/helm` umbrella chart `values-staging.yaml` 安装（CRDs 已在 `infra/helm/crds/` 保留）；
4. 复用本次 drill spec（`staging-ark-drill.spec.ts`）改 `E2E_BASE_URL` 指向 staging 入口即可复跑。

---

## 6. 证据文件

| 证据 | 路径 |
|------|------|
| Playwright 演练用例 | `metaplatform-frontend/tests/e2e/staging-ark-drill.spec.ts` |
| 截图 ×3（登录总览 / 类型管理全宽 / ARK 卡片） | `metaplatform-frontend/tests/e2e/.artifacts/drill-*.png` |
| 实测回包（对话/embedding） | 演练 transcript（E：`"1+1 equals 2."`；F：384 维） |
| IAM 托管配置状态 | `metaplatform_iam.iam_system_config`：`ai.provider.ark.*`（api_key len=46，敏感）、`default_active=ark`、`ai.embedding.default_provider=ark` |
| 单测 | IAM `test_admin_configs.py`（11）、llmgw 全量、copilot 216 |
