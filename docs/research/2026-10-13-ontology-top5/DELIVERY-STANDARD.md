# 实施、测试、独立部署与证据要求

## 范围

本次只提交调研文档和待办 issue，未实现这些改动、未触发发布，也未合并到 main。每个工单目标是完整的局部可观察行为，不要求重构整个模块。必须以领取工单时的最新 main 重验差距；若已经修复，引用当前 SHA/证据后关闭，不重复实现。

## 60 分钟预算与环境前提

5 分钟复现、20 分钟实现、15 分钟验证、15 分钟部署/回滚核对、5 分钟证据。开发依赖安装、独立 PostgreSQL 16 测试实例、测试身份和预热应用环境是前置条件；没有时记录实际阻塞。这个预算不是 CI 排队或首次构建的 SLA，不以超过 60 分钟为理由删测试或假报部署。

## 共用但不依赖其他新工单的基线

- 主仓库 AGENTS.md、ADR-0080（草稿版本）、ADR-0082（迁移）、ont.yaml 为实现依据。
- 前端：Node 22、前端工作区 pnpm-lock.yaml。后端：Python 3.12、mate-platform-backend/uv.lock；不要误用根锁文件。代码全部在自己的隔离工作树，保留其他工作树/WIP/预览/数据库。
- UI 沿用 Semi UI 与原有正式路由。已有 q/typeRef/linkRef 与 safeReturnTo；不要引入另一个工作室壳或第二套 ontology store。
- 新 contract 字段或错误语义先写契约；测试要覆盖实际失败/反例。纯文档提交核对链接和内容即可，无需编造实现测试。

## 测试入口

从前端工作区运行 `pnpm.cmd --filter @mate/web typecheck`、`pnpm.cmd --filter @mate/web build` 和 `pnpm.cmd --filter @mate/web test:unit -- <本工单实际测试文件>`。用仓库的 Playwright 配置启动独立端口的受控服务，实际运行本工单浏览器用例；下载类工单检查文件内容，保存/导入类工单刷新读回。用例文件由工单实施者创建并在执行日志记录，不把不存在的示例路径记成已通过。

后端使用 `mate-platform-backend/.venv/Scripts/python.exe -m pytest <本工单实际测试文件>`。涉及真实模型持久化/租户隔离，指定独立、非特权 PG/VER_PG_DSN，执行 `scripts/ci/verify_ont_postgres.py --junit .ci/ont-postgres.xml` 与所改 API 的数据库用例。缺 DB、skip 或只用 mock 均不得算数据库回归通过。legacy SPARQL 的 InstanceStore 测试只证明兼容路径，不当作 PostgreSQL/v2 业务验收。

按改动运行契约 bundle/lint 与仓库要求的 CI；PR 必需检查核对当前 SHA。故障注入/组件 mock 用于交互反例，与真实提供方验收分开写。

## 独立部署

Frontend 工单只改变 web 静态应用，Backend 工单只改变 ont 应用；没有新增 DB schema、外部引擎或共享服务。可以在各自的独立预热测试环境发布候选镜像并核对实际 UI/API；这是候选环境部署证据。仅在该工单被批准合入 main、必需 CI 通过之后使用仓库 Tencent Demo Deploy 流水线发云端。

现有 `.github/workflows/tencent-demo-deploy.yml` 只选受信 main revision；gate 与 deploy timeout 为 65/80 分钟。可手动 `workflow_dispatch operation=deploy/rollback`，但不要为满足一小时承诺跳过 gate、切到未审核 SHA 或改共享平台身份配置。应用更新和回滚是独立单工单能力，不需要等本次其他工单合入；具体整个平台流水线仍会执行它自己的门禁。

成功证据至少包括：候选/主干 SHA、镜像/发布 revision、测试结果、所改页面/接口实际结果；凡涉及写入要有相同用户/租户的持久化读回。应用回滚恢复上一镜像，不删除数据库/卷/历史数据。环境为故障或验收未做时标记未完成，不写 GA/Accepted。

## 返回给 reviewer 的内容

一项工单一个 PR：问题→行为变化→小范围 diff→测试结果→发布/回滚证据→未覆盖边界。给出真实耗时与环境状态；不要复述整份 TOP5 调研。无需把其他新工单作为 prerequisite。公共同文件修改可能冲突，正常重基后重跑相关测试即可，不扩大成整模块重构。
