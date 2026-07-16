# APP-DASHBOARD - 仪表盘

## 模块类型

APP 应用模块

## 作用

Mate Platform 的统一入口与数据看板。提供：
- 全局工作台与待办事项
- 企业关键指标可视化（运营效率、数据质量、Agent 执行统计）
- 快捷导航到各功能中心
- 消息通知与公告
- 个人中心与偏好设置

## 上游依赖

- `TECH-IAM`：用户认证与权限
- `TECH-GW`：API 网关
- `TECH-MSG`：消息通知
- `TECH-OBS`：运营指标数据

## 下游消费

- 用户浏览器

## 目录结构

```
APP-DASHBOARD/
├── README.md              # 本文件
├── src/                   # 源码目录
├── tests/                 # 测试目录
├── config/                # 配置文件
└── docker/                # 容器化配置
```

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
