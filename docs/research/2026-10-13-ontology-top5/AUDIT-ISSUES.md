# Ontology TOP5：18项工单交付索引

2026-10-13。该索引区分既有成果与本轮实际写入：保留16项既有工单，新增G17/#136、G18/#137，更新G03/#120为v2。没有重复创建#118–#133，没有实现功能或部署主干。

[本轮代码/功能/UI审校报告](AUDIT.md) · [原五项目详细报告](REPORT.md) · [项目专篇](projects/) · [交付边界](AUDIT-DELIVERY.md)。MetaPlatform源码基线dc8980d3e129e94f0bc55190705ede7cbe304ba0；原研究基线939aae37d28c03493c06947619766d78a124b2c0；新增文档内容固定于54be139c69c915e7b9fd840f2f35395bfda98988。

## 清单

| ID | 实际Issue | 优先级 | 代码边界 | 目标 |
|---|---|---|---|---|
| G01 | [#118](https://github.com/Bert0000000000/MetaPlatform/issues/118) | P1 | ont | Turtle业务名称安全转义 |
| G02 | [#119](https://github.com/Bert0000000000/MetaPlatform/issues/119) | P2 | ont | JSON-LD扩展词汇定义 |
| G03 | [#120](https://github.com/Bert0000000000/MetaPlatform/issues/120) | P1 | ont | 标题往返与技术身份隔离；v2 |
| G04 | [#121](https://github.com/Bert0000000000/MetaPlatform/issues/121) | P2 | web | Turtle下载入口 |
| G05 | [#122](https://github.com/Bert0000000000/MetaPlatform/issues/122) | P1 | web | JSON导入摘要与明确确认 |
| G06 | [#123](https://github.com/Bert0000000000/MetaPlatform/issues/123) | P2 | web | 类型列表加载失败/空状态与重试 |
| G07 | [#124](https://github.com/Bert0000000000/MetaPlatform/issues/124) | P1 | web | SHACL目标切换与迟到响应 |
| G08 | [#125](https://github.com/Bert0000000000/MetaPlatform/issues/125) | P2 | web | 完整目标绑定JSON校验报告下载 |
| G09 | [#126](https://github.com/Bert0000000000/MetaPlatform/issues/126) | P1 | web | 公理零执行/部分覆盖表达 |
| G10 | [#127](https://github.com/Bert0000000000/MetaPlatform/issues/127) | P2 | web | 用户/租户布局缓存隔离 |
| G11 | [#128](https://github.com/Bert0000000000/MetaPlatform/issues/128) | P2 | web | 搜索业务说明与属性标题 |
| G12 | [#129](https://github.com/Bert0000000000/MetaPlatform/issues/129) | P2 | web | 直接父类展示与点击定位 |
| G13 | [#130](https://github.com/Bert0000000000/MetaPlatform/issues/130) | P1 | ont | legacy SPARQL拒绝未执行写操作 |
| G14 | [#131](https://github.com/Bert0000000000/MetaPlatform/issues/131) | P1 | ont | legacy parser拒绝FILTER/OPTIONAL |
| G15 | [#132](https://github.com/Bert0000000000/MetaPlatform/issues/132) | P2 | web | SHACL真实severity展示 |
| G16 | [#133](https://github.com/Bert0000000000/MetaPlatform/issues/133) | P2 | web | 引用来源列的统计就地查看 |
| G17 | [#136](https://github.com/Bert0000000000/MetaPlatform/issues/136) | P1 | web | lint加载期不得假通过；本轮新增 |
| G18 | [#137](https://github.com/Bert0000000000/MetaPlatform/issues/137) | P2 | ont | 未知导出format明确拒绝；本轮新增 |

合计8项P1、10项P2；12项web、6项ont代码增量。均为一小时有效工作预算的局部需求，独立候选发布环境是否具备尚未在本轮验证；不保证云端审核/CI/部署在60分钟内结束。

## 新增/修订文档附件

- G03-v2：[下载PRD](https://raw.githubusercontent.com/Bert0000000000/MetaPlatform/54be139c69c915e7b9fd840f2f35395bfda98988/docs/research/2026-10-13-ontology-top5/gaps/g03/PRD.md) · [下载Prompt](https://raw.githubusercontent.com/Bert0000000000/MetaPlatform/54be139c69c915e7b9fd840f2f35395bfda98988/docs/research/2026-10-13-ontology-top5/gaps/g03/PROMPT.md)。原ZIP为历史，不再按旧版实现。
- G17：[下载PRD](https://raw.githubusercontent.com/Bert0000000000/MetaPlatform/54be139c69c915e7b9fd840f2f35395bfda98988/docs/research/2026-10-13-ontology-top5/gaps/g17/PRD.md) · [下载Prompt](https://raw.githubusercontent.com/Bert0000000000/MetaPlatform/54be139c69c915e7b9fd840f2f35395bfda98988/docs/research/2026-10-13-ontology-top5/gaps/g17/PROMPT.md)。
- G18：[下载PRD](https://raw.githubusercontent.com/Bert0000000000/MetaPlatform/54be139c69c915e7b9fd840f2f35395bfda98988/docs/research/2026-10-13-ontology-top5/gaps/g18/PRD.md) · [下载Prompt](https://raw.githubusercontent.com/Bert0000000000/MetaPlatform/54be139c69c915e7b9fd840f2f35395bfda98988/docs/research/2026-10-13-ontology-top5/gaps/g18/PROMPT.md)。

以上是已提交的真实仓库文件下载链接，并已写入对应Issue，不冒充GitHub原生user-attachments上传。其余15票原附件保持，详见原ISSUES.md及各票正文。每票均有可复制实施Prompt，含范围、反例、权限、部署/回滚与完成定义。

## 执行调度建议

先处理错误成功/数据保真类P1。相同文件为冲突组，不同时由多个执行者盲改：导出后端G01/G02/G03/G18；导入导出页G04/G05/G06；校验页G07/G08/G15/G17；legacy parser/API G13/G14。组内逐票领取、独立分支、重基复测；跨组可并行。不是业务依赖链，不要求一个组全部完成才能发布单票。

实施PR不可从研究分支直接开展大范围合并；从领取时最新main建小分支，并通过固定SHA读取本研究文档。文档PR不应使用自动关闭关键字关闭18张功能票。现有云端#111–#117仍保留原票，不被这批局部优化替代。
