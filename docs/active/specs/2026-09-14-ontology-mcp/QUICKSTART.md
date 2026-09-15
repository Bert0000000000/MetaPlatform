# 5 分钟速通 — 本体引擎 MCP 接入

> 从零到「外部 Agent 列出本体类型 + 提交一个提案」。完整配置与安全说明见同目录 [CLIENT-GUIDE.md](CLIENT-GUIDE.md)。

## 0. 前置

- 平台 API 网关在跑：`http://localhost:8100`（不通则先起平台）。
- 你有一个 MCP 客户端（本文以 Claude Code 演示；Codex/Cursor 见 CLIENT-GUIDE §3）。

## 1. 登录拿 token（30 秒）

```bash
export MATE_MCP_TOKEN=$(curl -s http://localhost:8100/api/v1/iam/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .accessToken)

echo "${MATE_MCP_TOKEN:0:20}..."   # 非空即成功
```

## 2. 加 server（30 秒）

```bash
claude mcp add --transport http mate-ontology \
  http://localhost:8100/api/v1/mcp/protocol/mcp \
  --header "Authorization: Bearer $MATE_MCP_TOKEN"
```

验证：`claude mcp list` 显示 `mate-ontology ... ✓ Connected` 即成功。

## 3. 列工具（30 秒）

进入 `claude` 会话，输入：

```
/mcp
```

在 MCP 面板选中 `mate-ontology`，应看到 `ont_list_classes`、`ont_inspect_class`、`ont_object_query`、`ont_propose_*` 等工具（清单详见 CLIENT-GUIDE §4）。

## 4. 调一个只读工具（90 秒）

在会话里直接说：

> 用 mate-ontology 的 ont_list_classes 列出所有本体类，然后挑一个用 ont_inspect_class 看它的属性，最后用 ont_object_query 查它前 5 条数据。

Agent 会依次调用三个只读工具并汇报结果。这一步验证了发现 → schema 检视 → 查询的完整读链路。

## 5. 提一个提案（90 秒）

> 用 ont_propose_instance 在某个类（比如刚才查到的类）下提议新建一条实例，字段你自己编，impact_summary 写清楚改了什么。拿到 proposal_id 后用 ont_preview_proposal 渲染给我看。

预期行为：

1. agent 调 `ont_propose_instance` → 返回 `proposal_id` + `expected_diff`（**不落库**）；
2. agent 调 `ont_preview_proposal` 渲染预览给你；
3. agent 停在这里 —— **confirm/execute 是 HITL 边界，agent 调不动**；
4. 由**用户**在平台前端（UI http://localhost:9250，admin/admin123，本体/提案中心）对该 proposal 点确认并执行，数据才真正落库。提案记录自动带溯源 `source=ai`。

到此你已完成外部 Agent 接入的完整闭环：只读探索 → 提案 → 人工确认落库。

## 排错

| 症状 | 原因 / 处置 |
| --- | --- |
| `claude mcp list` 显示连接失败 / 401 | token 过期或未展开：重新登录拿 token，删掉重加（`claude mcp remove mate-ontology` 后重跑第 2 步） |
| 404 | 网关未起或路径拼错，端点必须是 `http://localhost:8100/api/v1/mcp/protocol/mcp` |
| 调 confirm/execute 被拒（PermissionError） | 预期行为：HITL 边界，只有用户侧能调，见 CLIENT-GUIDE §4.3 |
| 工具列表里没有文档说的某工具 | 平台仍在追加工具（见 CLIENT-GUIDE §4.4），以 `/mcp` 面板实际列表为准 |
| 客户端只支持 stdio | 用桥接脚本 `scripts/mcp/mate-ont-mcp-stdio.py`，见 CLIENT-GUIDE §5 |
