# APP-APPHUB - 应用中心

## 模块类型

APP 应用模块

## 作用

Mate Platform 的应用管理中心，融合低代码设计器与流程设计器。提供：
- **应用列表**：已创建应用的管理、发布、版本控制
- **低代码设计器**：拖拽式页面设计、表单配置、数据模型绑定、组件市场
- **流程设计器**：基于 FlowGram.AI 的可视化流程建模
  - BPMN 审批流：审批人、条件分支、会签、委托、撤回、催办
  - Agent/Action 编排流：LLM 调用、RAG、Tool 调用、条件、循环
- **应用与流程联动**：页面动作绑定流程、流程节点触发页面数据更新
- **应用市场**：模板应用、组件复用、跨应用数据引用
- **AI 辅助开发**：SuperAI 辅助生成页面、表单、流程

## 上游依赖

- `TECH-ONT`：本体引擎（概念/实体/关系作为数据源）
- `TECH-WFE`：工作流引擎（流程运行时）
- `TECH-ACTION`：Action Engine（动作执行）
- `TECH-EA`：EA 架构资产（业务架构参考）
- `TECH-RULE`：规则引擎（条件判断）
- `APP-SUPERAI`：AI 辅助开发

## 下游消费

- `APP-DASHBOARD`（应用入口展示）
- 终端用户（使用已发布的应用）

## 目录结构

```
APP-APPHUB/
├── README.md
├── src/
│   ├── designer/          # 低代码设计器
│   ├── flow-designer/     # 流程设计器（FlowGram.AI）
│   ├── app-manager/       # 应用管理
│   └── app-store/         # 应用市场
├── tests/
├── config/
└── docker/
```

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
