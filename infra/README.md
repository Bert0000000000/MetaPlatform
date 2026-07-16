# infra - 基础设施配置

## 作用

存放 Kubernetes、Docker Compose、Helm、Terraform 等基础设施配置文件。

## 目录结构

```
infra/
├── k8s/              # Kubernetes 部署清单
├── docker-compose/   # Docker Compose 编排文件
├── helm/             # Helm Chart
└── terraform/        # Terraform 基础设施代码
```

## 上游依赖

- 所有 TECH 服务模块的 Dockerfile
- 各模块的配置文件

## 下游消费

- Kubernetes 集群
- Docker 运行环境

## 相关文档

- [项目总览](../README.md)
- [架构设计](../docs/001-ARCH/)
- [技术选型](../docs/002-TS/)

## M1 本地开发启动（Docker Compose）

项目根目录已提供 `.env`，默认连接 `infra/docker-compose.base.yml` 中的服务。

### 启动基础服务

```bash
cd infra
docker compose -f docker-compose.base.yml up -d
```

基础服务清单与端口：

| 服务 | 镜像 | 外部端口 | 默认账号/密码 |
|---|---|---|---|
| PostgreSQL | postgres:17 | 5432 | meta / meta |
| Redis | redis:7.4 | 6379 | meta（requirepass） |
| ZooKeeper | confluentinc/cp-zookeeper:7.8.0 | 2181 | - |
| Kafka | confluentinc/cp-kafka:7.8.0 | 9092 / 29092 | - |
| RabbitMQ | rabbitmq:4-management | 5672 / 15672 | meta / meta |

### 启动可观测性服务（可选）

```bash
cd infra
docker compose -f docker-compose.base.yml up -d
docker compose -f docker-compose.obs.yml up -d
```

可观测性服务清单与端口：

| 服务 | 镜像 | 外部端口 | 默认账号/密码 |
|---|---|---|---|
| Prometheus | prom/prometheus:v3.0.1 | 9090 | - |
| Grafana | grafana/grafana:11.3.1 | 3000 | meta / meta |

### 停止并清理

```bash
# 停止基础服务
docker compose -f docker-compose.base.yml down

# 停止可观测性服务
docker compose -f docker-compose.obs.yml down

# 完全清理（含数据卷）
docker compose -f docker-compose.base.yml down -v
docker compose -f docker-compose.obs.yml down -v
```

### 网络说明

所有服务共享 bridge 网络 `infra-net`。`docker-compose.obs.yml` 将该网络标记为 `external`，因此必须先启动 `docker-compose.base.yml` 来创建网络。
