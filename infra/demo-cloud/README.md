# 腾讯云单机演示部署

适用于中国大陆的 Ubuntu 24.04、x86_64、4 vCPU / 16 GB / 180 GB SSD。
沿用仓库的应用入口、API 网关和 Keycloak 登录，使用一个共享 Python 3.12
运行镜像启动各个服务；前端由 Node 22 构建后交给 Nginx 提供。

默认保留 20 个应用服务，以及 PostgreSQL 16、Redis、MinIO、Neo4j、Kafka、
Keycloak。RAG 使用 PostgreSQL；Milvus、Nacos、RabbitMQ 及额外 AI / Java /
监控组件按需启用。数据库、认证、对象文件和 Kafka 数据使用独立命名卷。
本体连接使用 NOSUPERUSER / NOBYPASSRLS 应用角色。后端依赖从本工作区
`uv.lock` 导出，前端依赖使用本工作区 `pnpm-lock.yaml`，不复制本机凭据或数据。

这是演示部署，保留 `MATE_PROFILE=development` 和演示种子。
没有模型密钥时不得把模型回退输出说成真实推理结果；实际模型能力需另行配置
提供商并验证。本部署不代表生产或 GA 验收。

## 准备和启动

依赖导出使用 uv 0.12.0，与演示 CI 固定版本一致。

从仓库根目录执行：

```sh
python infra/demo-cloud/prepare.py
docker compose --env-file infra/demo-cloud/private/.env \
  -f docker-compose.yml -f infra/demo-cloud/compose.yml config --quiet
docker compose --env-file infra/demo-cloud/private/.env \
  -f docker-compose.yml -f infra/demo-cloud/compose.yml build mate-api-gateway demo-web
docker compose --env-file infra/demo-cloud/private/.env -f docker-compose.yml -f infra/demo-cloud/compose.yml pull postgres redis minio neo4j kafka keycloak
docker compose --env-file infra/demo-cloud/private/.env \
  -f docker-compose.yml -f infra/demo-cloud/compose.yml up -d --pull never --wait --wait-timeout 300
python3 infra/demo-cloud/bootstrap.py
python3 infra/demo-cloud/verify.py
```

`prepare.py` 创建本次环境的随机凭据、Keycloak realm 和冻结的运行依赖文件。
已存在的凭据不会被覆盖。`private/` 与 `artifacts/` 不进入 Git。
初始化只对新建 PostgreSQL 数据卷运行；已有数据环境不应使用重置卷解决问题。

离线传输包由 `python infra/demo-cloud/bundle.py --images` 生成。上传源代码包和
镜像包后，先解压源代码，再使用 `docker load -i <镜像包>`；在服务器运行
`python3 infra/demo-cloud/prepare.py --skip-export` 创建服务器自己的凭据。
离线包已经包含冻结的依赖列表，不需要在服务器安装 uv 或重新构建镜像。
文件大小和 SHA-256 见 `artifacts/bundle-manifest.json`。

也可以只上传 `python infra/demo-cloud/bundle.py` 生成的源代码包，在服务器执行
`prepare.py --skip-export` 后在线构建。大陆网络下可给 build 加
`--build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/`。
腾讯云 Docker 加速源设置见
[官方文档](https://cloud.tencent.com/document/product/1207/45596)。
本次 MinIO 标签的附属证明元数据下载失败；实际 x86_64 镜像已按该标签的官方
清单所列摘要 `sha256:477acdac119305949d9a6f5f3fbe2d8029e18c5e39de11034d3ffec03cc69e48`
从腾讯镜像源拉取后标记为原标签。

默认入口仅监听 `127.0.0.1:8080`，后端和数据库没有宿主机公开端口。
确认登录、持久化读写后，再根据域名和备案状态配置对外入口及 HTTPS。
不要直接把仓库默认开发 Compose 的全部端口暴露到公网。

已有 80 端口规则且无域名时，可在服务器执行：

```sh
python3 infra/demo-cloud/configure_web.py --bind-address 0.0.0.0 --port 80 --origin http://192.144.136.178
docker compose --env-file infra/demo-cloud/private/.env -f docker-compose.yml -f infra/demo-cloud/compose.yml up -d --pull never --wait --wait-timeout 300
python3 infra/demo-cloud/verify.py --read-only --base-url http://127.0.0.1
```

将 IP 替换为目标服务器。前端显示 `DEMO` 环境标识。
账号密码位于服务器 `infra/demo-cloud/private/demo-accounts.json`；登录页面中的
历史开发密码 `admin123` 不适用于本部署。

Compose 必须支持 `!reset` / `!override`（2.24.4 或更新版本）；该覆盖文件
显式清除开发环境的端口、源码挂载和固定容器名。
参考 [Docker 合并规则](https://docs.docker.com/reference/compose-file/merge/)。

## 验证与运维

需要实际验证登录、对象类型/实例的写入与读回，以及容器重启后的数据保留，
再记录此演示环境的访问结果。单独的容器健康检查不代表业务验证完成。

`bootstrap.py` 使用明确的 `tenant-default` 上下文导入核心演示数据，再调用
仓库已有的 `scripts/ont/apply_rls.py` 开启强制 RLS，不打印带密码的 DSN。
本体服务的启动种子关闭，避免重启时以空租户重复写入。完整 HR/IT/财务数字
员工种子当前包含不受解析器支持的 `ref://` 动作引用，本部署仅使用核心演示
种子；这项源码问题不在本次基础设施部署中扩展修复。

初次 `verify.py` 保存独立命名空间的模型、实例和执行提案，然后以 `--read-only`
复核重启后的登录与数据。它还验证匿名拒绝、跨租户写入拒绝、PostgreSQL 应用
角色和强制 RLS 下的跨租户读隔离。证据保存在 `artifacts/acceptance-*.json`。

查看状态、日志和资源：

```sh
docker compose --env-file infra/demo-cloud/private/.env \
  -f docker-compose.yml -f infra/demo-cloud/compose.yml ps
docker compose --env-file infra/demo-cloud/private/.env \
  -f docker-compose.yml -f infra/demo-cloud/compose.yml logs --tail 100 mate-tech-ont
docker stats --no-stream
```

备份 PostgreSQL 时使用当前 Compose 项目的 `postgres` 服务执行 `pg_dumpall`，
同时保留 `private/` 和 MinIO 数据备份。更新前保存镜像标签和数据库备份；
不要执行 `down -v`、全局 prune 或共享环境的清理命令。

# 自动部署

GitHub 合并后自动部署的流程、权限与回滚边界见 [CICD.md](CICD.md)。以下命令保留用于首次部署和人工维护。
