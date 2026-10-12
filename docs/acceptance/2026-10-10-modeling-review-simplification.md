# 逆向审核简化：本地验收

本轮只修改独立逆向入口与 modeling 范围编排。用户已批准精简交互；本地实现不代表 PR/主干 CI、部署或业务语义验收通过，也不声明符合未经核验的 Palantir 官方/内部标准。

## 行为

- 对象确认同时确认有依据的身份；关系确认同时确认有依据且关联完整的基数。批量审核先展示规则、依据与不能确认的原因。身份选择直接更新实际身份字段，避免“候选身份”与实际身份不一致。
- 修改对象说明不撤销无关关系审核；修改身份、属性结构、父类及替代唯一键继续要求相关关系复审。
- included 与 accepted 分离，默认纳入。暂缓不删除候选，恢复需重新审核；暂缓对象会在确认框列出后代与端点关系影响。服务端拒绝空范围和悬空继承/端点。
- 结构校验、证据、原生冲突、方案、图谱和可选同步使用同一所选范围；完整草稿仍参与指纹。未知引用仍报错，不能作为暂缓项被静默过滤。
- 已有发布结果后服务端锁定范围，保留重试记录。增量须另建候选并复用已有原生类型，当前未提供跨发布轮次的自动追加按钮。暂缓项和业务覆盖缺口明确展示，不声称全部建模完成。
- 沿用 ADR-0080 草稿/不可变版本/并发门禁与 ADR-0082 原生迁移路径，没有修改正向内核语义。

## 本轮证据

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 核心、AI、ACL 回归 | 190 passed；最后新增 AI 不可替用户暂缓的回归，assistant-client 14 passed | 本轮 pytest 输出 |
| 独立 PostgreSQL 逆向闭环 | 22 passed，0 skipped；包含保存重开、所选范围发布同步、发布后范围锁 | `.ci/review-modeling-pg.xml` |
| 必需 PostgreSQL 16 原生门禁 | 123 executed，0 skipped，6 required suites；非特权角色 | `.ci/review-native-pg.xml`、`.ci/review-native-pg.txt` |
| 前端单元 | 29 passed | `.ci/review-frontend.txt` |
| 浏览器 | 6 passed：统一审核/暂缓/保存重开/图谱/原生发布；制造、销售、三级继承、数据修正及移动入口 | `.ci/review-browser.txt`、`metaplatform-frontend/test-results/modeling.xml` |
| 保存与数据保护 | 重启独立 ONT 前确认没有运行任务；重启前已有 55 个来源逐个只读比对完全一致 | `.ci/review-preservation.json` |
| 契约与静态 | included OpenAPI 布尔默认值核对；Ruff、前端 typecheck 通过 | 本轮命令输出 |
| 前端构建 | build 成功；现有 chunk 大小提示仍在 | `.ci/review-build.txt` |

依赖沿用当前隔离工作树已有 venv/node_modules；本轮没有重新安装依赖或更换锁文件。真实用户来源未代确认、未发布、未同步；浏览器仅创建独立验收来源。原生服务与其他工作树保留。
