# Ontology TOP5 调研与18项工单交付

日期：2026-10-13。MetaPlatform源码基线dc8980d3e129e94f0bc55190705ede7cbe304ba0。状态：研究与待实施需求；未实现、合并或部署本批功能。

## 当前入口

- [代码、功能、UI交互交叉审校与18项差距](AUDIT.md)
- [18项Issue实际编号、当前附件版本与调度建议](AUDIT-ISSUES.md)
- [一小时粒度、独立验证与部署/回滚边界](AUDIT-DELIVERY.md)
- [G03 v2 PRD](gaps/g03/PRD.md) / [Prompt](gaps/g03/PROMPT.md)：#120，标题与技术身份分离。
- [G17 PRD](gaps/g17/PRD.md) / [Prompt](gaps/g17/PROMPT.md)：#136，lint加载期间不提前显示通过。
- [G18 PRD](gaps/g18/PRD.md) / [Prompt](gaps/g18/PROMPT.md)：#137，未知导出格式明确拒绝。

原16项保留，新增2项，合计18份PRD与18份Prompt。每票自己的功能、测试、候选发布和回滚同票交付；开发需从领取时最新main建独立实施分支。研究分支不是应用实施分支。

## 五个项目专篇与历史研究

[Semantica](projects/01-semantica.md) · [Utopia](projects/02-utopia.md) · [TrustGraph](projects/03-trustgraph.md) · [Protégé](projects/04-protege.md) · [TIS](projects/05-tis.md)。

[原完整报告](REPORT.md)、[原16项矩阵](GAP-MATRIX.md)、[原16项发布索引](ISSUES.md)、[原交付规范](DELIVERY-STANDARD.md)保留历史。部分结论以AUDIT.md审校补充为准；G03原ZIP中的旧版实施细节已被v2替代，勿单独执行。

[候选池](evidence/candidate-pool.json) · [仓库SHA快照](evidence/repository-snapshots.json) · [源码清单](evidence/source-manifest.json)。TOP5是topic:ontology候选范围内相关软件按Stars筛选，不是整个GitHub穷尽质量榜。

## 附件及验证边界

旧票附仓库ZIP；G03-v2/G17/G18的Issue附已提交真实Markdown原文件固定SHA下载链接及在线阅读入口，不是GitHub原生user-attachments上传。以各Issue当前正文的有效版本为实施单源。

本轮UI分析依据源码/官方文档，未实机运行五产品；代码SHA不等于部署SHA。候选独立发布环境尚未本轮验证，云端仍需受信main/审核/required CI；一小时不是CI排队到正式云端上线的时钟保证。完整OWL2或任意本体无损迁移不属于18票完成后的自动成果。
