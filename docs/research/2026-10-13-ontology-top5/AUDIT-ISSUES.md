# Ontology TOP5：18张独立Issue与36份独立文档

2026-10-13交付形式调整：每个差距一张Issue，PRD.md和PROMPT.md是两个独立文件，分别在对应Issue中提供固定SHA原文件下载与在线阅读链接。不再以压缩包、合并文档或导航压缩包交付。

本次已更新#118–#133的正文文件入口，G03保留v2；#136、#137原本已采用独立文件入口，未重复创建。没有改变需求范围、优先级、测试、发布/回滚验收或Issue状态。历史打包文件仅保留存档，不再作为当前交付入口。

[代码/功能/UI审校报告](AUDIT.md) · [原详细研究](REPORT.md) · [交付边界](AUDIT-DELIVERY.md)。MetaPlatform源码基线dc8980d3e129e94f0bc55190705ede7cbe304ba0；原研究基线939aae37d28c03493c06947619766d78a124b2c0；G03-v2/G17/G18正文固定于54be139c69c915e7b9fd840f2f35395bfda98988。以下是文件目录，不把需求正文合并成一个文件。

## 逐项文件入口

每行的PRD与Prompt分别打开对应独立文件；需要原文件时使用该行Issue正文中的“单独下载原文件”。

| ID | 实际Issue | 优先级 | 代码边界 | 目标 | 独立PRD | 独立Prompt |
|---|---|---|---|---|---|---|
| G01 | [#118](https://github.com/Bert0000000000/MetaPlatform/issues/118) | P1 | ont | Turtle业务名称安全转义 | [PRD](gaps/g01/PRD.md) | [Prompt](gaps/g01/PROMPT.md) |
| G02 | [#119](https://github.com/Bert0000000000/MetaPlatform/issues/119) | P2 | ont | JSON-LD扩展词汇定义 | [PRD](gaps/g02/PRD.md) | [Prompt](gaps/g02/PROMPT.md) |
| G03 | [#120](https://github.com/Bert0000000000/MetaPlatform/issues/120) | P1 | ont | 标题往返与技术身份隔离；v2 | [PRD v2](gaps/g03/PRD.md) | [Prompt v2](gaps/g03/PROMPT.md) |
| G04 | [#121](https://github.com/Bert0000000000/MetaPlatform/issues/121) | P2 | web | Turtle下载入口 | [PRD](gaps/g04/PRD.md) | [Prompt](gaps/g04/PROMPT.md) |
| G05 | [#122](https://github.com/Bert0000000000/MetaPlatform/issues/122) | P1 | web | JSON导入摘要与明确确认 | [PRD](gaps/g05/PRD.md) | [Prompt](gaps/g05/PROMPT.md) |
| G06 | [#123](https://github.com/Bert0000000000/MetaPlatform/issues/123) | P2 | web | 类型列表加载失败/空状态与重试 | [PRD](gaps/g06/PRD.md) | [Prompt](gaps/g06/PROMPT.md) |
| G07 | [#124](https://github.com/Bert0000000000/MetaPlatform/issues/124) | P1 | web | SHACL目标切换与迟到响应 | [PRD](gaps/g07/PRD.md) | [Prompt](gaps/g07/PROMPT.md) |
| G08 | [#125](https://github.com/Bert0000000000/MetaPlatform/issues/125) | P2 | web | 完整目标绑定JSON校验报告下载 | [PRD](gaps/g08/PRD.md) | [Prompt](gaps/g08/PROMPT.md) |
| G09 | [#126](https://github.com/Bert0000000000/MetaPlatform/issues/126) | P1 | web | 公理零执行/部分覆盖表达 | [PRD](gaps/g09/PRD.md) | [Prompt](gaps/g09/PROMPT.md) |
| G10 | [#127](https://github.com/Bert0000000000/MetaPlatform/issues/127) | P2 | web | 用户/租户布局缓存隔离 | [PRD](gaps/g10/PRD.md) | [Prompt](gaps/g10/PROMPT.md) |
| G11 | [#128](https://github.com/Bert0000000000/MetaPlatform/issues/128) | P2 | web | 搜索业务说明与属性标题 | [PRD](gaps/g11/PRD.md) | [Prompt](gaps/g11/PROMPT.md) |
| G12 | [#129](https://github.com/Bert0000000000/MetaPlatform/issues/129) | P2 | web | 直接父类展示与点击定位 | [PRD](gaps/g12/PRD.md) | [Prompt](gaps/g12/PROMPT.md) |
| G13 | [#130](https://github.com/Bert0000000000/MetaPlatform/issues/130) | P1 | ont | legacy SPARQL拒绝未执行写操作 | [PRD](gaps/g13/PRD.md) | [Prompt](gaps/g13/PROMPT.md) |
| G14 | [#131](https://github.com/Bert0000000000/MetaPlatform/issues/131) | P1 | ont | legacy parser拒绝FILTER/OPTIONAL | [PRD](gaps/g14/PRD.md) | [Prompt](gaps/g14/PROMPT.md) |
| G15 | [#132](https://github.com/Bert0000000000/MetaPlatform/issues/132) | P2 | web | SHACL真实severity展示 | [PRD](gaps/g15/PRD.md) | [Prompt](gaps/g15/PROMPT.md) |
| G16 | [#133](https://github.com/Bert0000000000/MetaPlatform/issues/133) | P2 | web | 引用来源列的统计就地查看 | [PRD](gaps/g16/PRD.md) | [Prompt](gaps/g16/PROMPT.md) |
| G17 | [#136](https://github.com/Bert0000000000/MetaPlatform/issues/136) | P1 | web | lint加载期不得假通过 | [PRD](gaps/g17/PRD.md) | [Prompt](gaps/g17/PROMPT.md) |
| G18 | [#137](https://github.com/Bert0000000000/MetaPlatform/issues/137) | P2 | ont | 未知导出format明确拒绝 | [PRD](gaps/g18/PRD.md) | [Prompt](gaps/g18/PROMPT.md) |

合计18份PRD、18份Prompt；8项P1、10项P2；12项web、6项ont代码增量。文件是已提交的仓库Markdown，不是GitHub原生user-attachments上传。当前Issue正文中的固定版本为领取工单的文档依据。

## 五个项目的独立调研文件

| 项目 | 独立文件 |
|---|---|
| Semantica | [01-semantica.md](projects/01-semantica.md) |
| Utopia | [02-utopia.md](projects/02-utopia.md) |
| TrustGraph | [03-trustgraph.md](projects/03-trustgraph.md) |
| Protégé | [04-protege.md](projects/04-protege.md) |
| TIS | [05-tis.md](projects/05-tis.md) |

各专篇保留独立文件；审校补充见AUDIT.md，不以总报告替代各项PRD/Prompt。

## 执行调度与验收边界

先处理错误成功/数据保真类P1。相同文件为冲突组，不同时由多个执行者盲改：导出后端G01/G02/G03/G18；导入导出页G04/G05/G06；校验页G07/G08/G15/G17；legacy parser/API G13/G14。组内逐票领取、独立分支、重基复测；跨组可并行。不是业务依赖链，不要求一个组全部完成才能发布单票。

每项功能、测试、候选部署和回滚同票验收。60分钟为环境预热后的有效工作预算，不保证CI排队、审批或正式云端上线在60分钟内结束；独立候选环境是否具备未由本研究验证。完整边界见AUDIT-DELIVERY.md。

实施从领取时最新main建小分支，通过固定SHA读取本研究文档；不要直接以整个研究分支做功能实施PR。文档PR不自动关闭18张功能票。现有云端#111–#117保持原票，本次仅调整文件交付方式，没有实现或部署这些功能。
