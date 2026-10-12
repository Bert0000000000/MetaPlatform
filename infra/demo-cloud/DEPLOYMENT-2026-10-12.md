# 腾讯云演示部署记录

2026-10-12，演示环境已部署到腾讯云北京实例 `lhins-gsom8zda`。

| 项目         | 当前结果                                                             |
| ------------ | -------------------------------------------------------------------- |
| 访问入口     | http://192.144.136.178                                               |
| 配置         | 4 vCPU / 16 GB / 180 GB SSD，Ubuntu 24.04                            |
| 部署目录     | `/home/ubuntu/metaplatform-demo-20261012/app`                        |
| Compose 项目 | `metaplatform-demo`                                                  |
| 源码基线     | `816684e7c664`，本工作树新增 `infra/demo-cloud/` 部署配置            |
| 运行状态     | 20 个应用、6 个基础组件、1 个前端，共 27 个容器健康                  |
| 入口         | 仅前端发布公网 TCP 80；数据库和后端无宿主机公开端口                  |
| 资源快照     | 可用内存 11937 MiB / 总计 15609 MiB；交换区未使用；磁盘已用 13.1 GiB |
| 页面标识     | `DEMO`                                                               |

## 访问与账号

使用 `admin` 账号，随机密码保存在本机 `private/cloud-demo-accounts.json`。
服务器对应文件为 `infra/demo-cloud/private/demo-accounts.json`。
页面中的 `admin123` 是源码保留的历史开发提示，本次部署已经替换为随机密码。
暂时通过 IP 和 HTTP 访问。

## 已验证的业务链

- 通过 Nginx → API 网关 → Auth 服务 → Keycloak 真实登录，令牌绑定
  `tenant-default` 和实际用户 subject。
- 通过网关创建对象类型，发起实例提案，确认并执行；对象属性和提案终态读回一致。
- 重启本次 PostgreSQL、Keycloak 和本体服务后，重新登录并读回同一模型、实例与提案。
- 匿名请求和跨租户写入被拒绝；应用数据库角色为 `NOSUPERUSER / NOBYPASSRLS`。
- 28 张本体租户表启用强制 RLS；相同记录在本租户可读，在另一租户读取为 0 行。
- 从公网浏览器登录，实际数据库记录在对象浏览页面显示，截图见
  [公网验收截图](artifacts/cloud-demo-public.jpg)。
- Node 22 下前端类型检查与构建成功；Python 3.12.15 实际运行。
  运行容器中的本体 repository、migration 文件 SHA-256 与上传源码一致。

机器可读证据为 [首次写入](artifacts/acceptance-initial.json)、
[重启后读回](artifacts/acceptance-after-restart.json) 和
[部署快照](artifacts/deployment-snapshot.json)。

## 备份与复用

服务器 `/home/ubuntu/metaplatform-demo-20261012/backups/` 已保存初始化数据库与
私有配置备份；本机另存于忽略提交的 `private/cloud-initial-20261012.sql.gz`
和 `private/cloud-private-config-20261012.tar.gz`。本轮没有执行恢复演练。

源代码传输包 SHA-256：
`d9d3c7c1efccac55743837dc1ecead96ca59616493581001b6b081223dc068cd`。
服务器与本机摘要一致。复用命令见 [部署说明](README.md)。

本次没有复制本机数据库、认证密钥或模型凭据。构建转到新服务器完成；
本轮没有重启或清理本机 Docker、共享容器、数据卷或其他工作树。
临时 SSH 公钥已从服务器撤销，复核新连接认证被拒绝；本机专用私钥已删除，
部署隧道已关闭，公网入口仍返回 200。Docker 服务已确认开机启用。

## 当前演示边界

模型提供商密钥尚未配置，真实 AI 推理与联网搜索未验收。
完整数字员工种子曾因不支持的 `ref://dw_hr_recruiter_execute` 引用中止；
已写入的演示模型保留，后续初始化只使用核心种子，不宣称完整员工动作可执行。
未进行并发压测、完整 R1 回归、生产或 GA 验收。
