# APP-ARCH - 架构中心

## 模块类型

APP 应用模块

## 作用

企业 EA（Enterprise Architecture）架构管理中心。提供：
- **业务架构**：业务能力地图、价值流、业务流程梳理
- **应用架构**：应用系统全景、应用间依赖关系、技术债务追踪
- **数据架构**：数据主题域、数据流转图、数据资产目录
- **技术架构**：技术栈清单、基础设施拓扑、技术标准管理
- **架构治理**：架构评审、标准规范、变更影响分析
- **与 Ontology 联动**：业务架构概念映射到 Ontology 实体

## 上游依赖

- `TECH-EA`：EA 架构资产服务
- `TECH-ONT`：本体引擎（概念映射）
- `TECH-DATA`：数据架构信息来源

## 下游消费

- `APP-APPHUB`：应用开发参考业务架构
- `APP-ONTSTUDIO`：Ontology 建模参考数据架构
- `APP-DASHBOARD`：架构健康度指标

## 目录结构

```
APP-ARCH/
├── README.md
├── src/
│   ├── business-arch/     # 业务架构
│   ├── app-arch/          # 应用架构
│   ├── data-arch/         # 数据架构
│   ├── tech-arch/         # 技术架构
│   └── governance/        # 架构治理
├── tests/
├── config/
└── docker/
```

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
