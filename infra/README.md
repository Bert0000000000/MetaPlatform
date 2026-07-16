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
