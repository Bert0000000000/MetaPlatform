# Ontology TOP5：分文件交付

日期：2026-10-13。MetaPlatform源码调研基线dc8980d3e129e94f0bc55190705ede7cbe304ba0。状态：研究与待实施需求；本次文件交付调整没有实现、合并或部署本批功能。

## 18张Issue，36份独立需求文件

每个差距保持一张独立Issue，分别附PRD.md和PROMPT.md两个独立文件的固定版本原文件下载链接与在线阅读入口。不把两种文档合成一个文件，不以压缩包交付，也不要求先下载整套报告。

**[逐项打开18张Issue及各自PRD、Prompt](AUDIT-ISSUES.md)**

Issue编号：G01–G16对应#118–#133，G17对应#136，G18对应#137。#118–#133的正文已调整为独立文件入口；#136、#137原本已是独立文件，无重复建票。G03使用v2，不再按旧版标题处理细节实施。每张Issue保留原范围、优先级、独立测试、发布和回滚要求。

本目录的AUDIT-ISSUES.md只提供文件索引，不代替36份独立正文。研究文档PR只是存档容器，不是把18张功能Issue合成一张；实施仍从领取时最新main建单项小分支。

## 五个项目分别阅读

- [Semantica：代码、功能、UI调研](projects/01-semantica.md)
- [Utopia：代码、功能、UI调研](projects/02-utopia.md)
- [TrustGraph：代码、功能、UI调研](projects/03-trustgraph.md)
- [Protégé：代码、功能、UI调研](projects/04-protege.md)
- [TIS：代码、功能、UI调研](projects/05-tis.md)

## 参考与验收边界

[交叉审校报告](AUDIT.md) · [一小时粒度、测试与发布/回滚边界](AUDIT-DELIVERY.md) · [原完整研究](REPORT.md)。旧版研究与历史打包文件仅保留存档，不作为当前需求下载入口；当前附件以各Issue正文和AUDIT-ISSUES.md为准。

[候选池](evidence/candidate-pool.json) · [仓库SHA快照](evidence/repository-snapshots.json) · [源码清单](evidence/source-manifest.json)。TOP5为topic:ontology候选范围内相关软件按Stars筛选，不是整个GitHub穷尽质量榜。

文件链接指向已提交的仓库Markdown，不是GitHub原生user-attachments上传。UI分析依据源码/官方文档，未实机运行五产品，代码SHA不等于部署SHA。候选独立发布环境未由本研究验证；云端仍需受信main、审核和required CI。一小时不是CI排队到正式上线的时钟保证。完整OWL2与任意本体无损迁移不属于18票完成后的自动成果。
