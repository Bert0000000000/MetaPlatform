# 北极星 demo v2 全链路走查（最终冲刺批次一）

> 日期: 2026-09-09 · 环境: Vite 9250 真界面 + 网关 8100 + Keycloak RS256 真登录
> 脚本: `metaplatform-frontend/tests/e2e/northstar-demo-v2.cjs`（真实 IAM API 登录注入 storage）

## 走查链路与截图（tests/e2e/screenshots/）

| 站点           | 截图                            | 内容                                                                                                                                                                                                           |
| -------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 登录         | northstar-01-login.png          | 平台登录页                                                                                                                                                                                                     |
| 2 工作台       | northstar-02-workbench.png      | 真实 token 注入后 dashboard                                                                                                                                                                                    |
| 3 SuperAI 对话 | northstar-03-superai-loaded.png | /superai/chat 加载                                                                                                                                                                                             |
| 4 SuperAI 回答 | northstar-04-superai-answer.png | 真实对话流（RAG 引用卡片「Mate Platform 介绍·核心能力」+ 会话历史；LLM 通道 = ARK Plan GLM-5.3-flash，stub-fallback 已消除——API 层真实返回证据见 scripts/smoke_sprint_final_batch1.py 邻接测试与 SPRINT 记录） |
| 5 本体引擎     | northstar-05-ontology.png       | **48 概念 / 97 属性 / 8 关系**；一级本体侧栏可见当日 live 核销脚本创建的类型（batch1/dedup-_/diag-_），数据真实闭环                                                                                            |
| 6 数据资产目录 | northstar-06-data-assets.png    | /arch/data/assets 目录页                                                                                                                                                                                       |

## 结论

北极星核心链（登录 → SuperAI 真对话 → 本体引擎 → 数据资产）在真实栈上全程可走，
截图留证。批注：SuperAI 对话为 RAG 增强链（资料引用卡片），LLM 真实性由 API 层
e2e（默认模型真实返回 `DEFAULT-MODEL-OK`，无 stub-fallback）单独留证。
