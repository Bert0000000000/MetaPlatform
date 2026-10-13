# 腾讯云演示环境 CI/CD

目标：PR 合并到 `main` 后，自动部署到已有腾讯云服务器。演示站点继续使用公网 IP，部署不需要新购云产品。

## 发布流程

1. PR 运行现有检查和 `Tencent Demo CI`，不接触服务器密钥。
2. 合并后，在同一个 main 提交上运行前端、后端、OpenAPI、GA、本体闭环和演示部署检查。部署等待这些工作流全部成功；失败、取消、缺少结果均停止发布。
3. GitHub 打包由后端 `uv.lock` 导出的依赖和源码，以 SSH 传输并校验 SHA-256。服务器构建带提交 SHA 的应用镜像。
4. 切换前备份两个 PostgreSQL 数据库，保留当前应用版本和验证记录。只更新平台应用容器，沿用当前 Compose 项目、账号、网络与数据卷。
5. 切换后验证真实登录、AppHub 应用/模块目录和合成对象类型的绑定使用情况、本体记录读回、实例提议确认执行及 PostgreSQL 租户隔离。成功才登记新版本；失败则恢复上一版应用并重新验证。

镜像版本通过 `sudo env` 显式传递三个公开发布设置，避免 sudo 清理进程环境后回退到配置文件的旧标签。验收还核对全部应用的实际镜像标签，健康但运行错误版本也视为失败。

部署互斥执行。排队的旧提交在发布前检查 main 是否已前进，避免旧版本覆盖新版本。GitHub 断开连接时，服务器上的发布进程继续完成并留下状态。

GitHub Runner 向国内服务器上传源码单独使用 15 分钟超时，状态查询使用 2 分钟超时。上传日志记录文件大小和耗时；传输超时后先核对服务器发布状态，再重试，避免把未完成传输当作发布成功。

## GitHub 和服务器访问

- GitHub Environment：`tencent-demo`，只允许 `main` 使用。
- 环境 Secret：`TENCENT_DEMO_SSH_KEY`，专用长期部署私钥。
- 环境 Variables：主机、SSH 用户、端口和已核对的主机公钥。
- 服务器对应公钥使用 OpenSSH `restrict` 和固定命令，只接受发布、查看发布状态及恢复上一版应用，关闭交互终端和端口转发。
- 服务器控制程序独立安装在 root 管理的目录；发布归档不能覆盖该程序。项目的数据库密码、Keycloak 密钥和演示账号不上传 GitHub。

持久部署密钥需要单独授权：上一轮临时 SSH 密钥已经撤销，不能用作长期 CI 凭据。

部署工作流使用 GitHub 的 [workflow_run 完成事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)，并额外验证来源仓库、push 事件、main 分支、提交 SHA 和全部 CI 结果。

## 首次接通与操作

管理员在服务器安装固定命令接收器，并添加专用公钥：

```sh
sudo python3 infra/demo-cloud/install_ci.py \
  --root /home/ubuntu/metaplatform-demo-20261012 \
  --public-key /path/to/ci-public-key.pub \
  --baseline-revision 816684e7c6649c89831f3db360a941f7759ded98
```

GitHub 环境只允许 main 分支，不设置每次人工审批。私钥通过 `gh secret set TENCENT_DEMO_SSH_KEY --env tencent-demo` 的标准输入保存，避免出现在命令历史和日志中。

合并后查看 Actions → `Tencent Demo Deploy`，成功结果归档为 `tencent-demo-deploy-result`。人工重新发布或恢复上一版应用：

```sh
gh workflow run tencent-demo-deploy.yml --ref main -f operation=deploy
gh workflow run tencent-demo-deploy.yml --ref main -f operation=rollback
```

数据库备份位于服务器部署目录的 `ci/backups/`，详细私有日志在 `ci/logs/`。旧应用目录和镜像保留供回滚使用；禁止执行 `docker compose down -v` 或全局清理。

## Excel 建模同步依赖与发布验收

腾讯云本体应用显式传入 `ONT_MODELING_SOURCE_DSN`，与 `KERNEL_PG_DSN` 指向同一个 `metaplatform_ont` 数据库，并使用原有非特权 `mate_app` 角色和私有密码。Excel 暂存写入与原生背挂来源读取必须使用同一目标；保留租户隔离、模型发布基线和数据校验，不能用放宽同步条件替代配置修复。此依赖与“接入注册数据源”的连接参数（#112）分别管理。

每次新版本发布由 `verify.py` 上传独立合成工作簿，显式保存审核后的两个类型和关系，发布后执行 `ontCheckModelingDataSync` / `ontSyncModelingSource`，GET 读回 4 个实例与 2 条关系，再重跑同一批次核对稳定身份和数量。任一配置、校验、同步状态或字段/端点/数量不符即验收失败，沿用现有回滚流程。凭据不会进入公开验收报告。

合成记录收据随 `artifacts/acceptance-state.json` 保存；已有收据在 `--read-only` 时只读回。首次升级旧版本时，旧收据没有 Excel 项，不把旧收据当成该项通过证据；随后必需的首次写入验收执行完整探针。探针不读取或同步用户现有企业工作簿；#139 的原企业批次业务验收须用原映射重新检查和同步后独立登记。

## 适用范围

这是单机演示部署，更新应用时有短暂访问中断。4 核 16 GB 可复用现有镜像构建缓存。基础设施容器、数据卷和现有配置不自动重建。

自动回滚恢复应用版本，不自动恢复数据库。发布前的备份用于人工恢复；不兼容的数据库或基础设施改动需要安排维护。完整 R1 / GA 业务验收仍以仓库规定的证据为准。

## AppHub 目录准备与验收

应用切换前，`configure_schema.py` 在同一事务和 PostgreSQL 维护锁下检查并准备明确白名单中的 `apphub_apps`、`apphub_groups`、`apphub_domains`、`apphub_modules`、`apphub_pages`、`apphub_templates`、`apphub_shortlinks` 与 `mcp_api_keys`。缺表只按现有 ORM 创建；已有表仅允许 MP11 发布字段、页面定义与 MCP scopes 的已审查增量。其他缺列、类型/可空性冲突、不安全 scopes 默认值或存量授权冲突在任何变更前阻止升级。

目录准备不写入种子记录、不更新已有应用、模块、页面、发布快照或授权，也不修改 Alembic 版本戳。重复执行不产生 DDL/DML 变更。正式入口仍要求批准的演示数据库地址及实际连接目标；SQLite 仅用于独立测试，PostgreSQL 由 MP11 CI 的隔离目标执行。

登录与合成对象类型读回后，发布验收实际请求 `/api/v1/apphub/modules` 与 `/api/v1/apphub/bindings/usage?class_rid=<合成对象 RID>`，初次发布和重启读回均执行。空的已知列表可通过；HTTP 错误或无法识别的列表响应阻止发布登记并触发现有应用回滚流程。
