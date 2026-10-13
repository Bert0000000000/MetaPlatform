# G17 执行 Prompt

只实施Bert0000000000/MetaPlatform的G17：反模式检查加载期间不得显示“未发现反模式”。先读最新main的AGENTS.md、本PRD、../../AUDIT-DELIVERY.md，建隔离分支并保留全部WIP/工作树/数据库/预览；基线dc8980d3e129e94f0bc55190705ede7cbe304ba0仅供复核，先查当前代码和PR去重。

定位metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx的findings/loading/error、load、PageHeader及lint渲染。初始化loading=true但findings=[]，渲染未优先判断loading。只修lint状态，不改SHACL、公理、服务端规则或API；不依赖G07。

先写失败用例：pending无零项成功；[]完成后才显示带覆盖范围的零项结论；非空展示实际项；重查隐藏旧结果；失败显示原因和重试且无绿色结论；快速点击不产生并行重复请求；卸载/迟到响应不覆盖失效状态。必要时参考本平台OntologyGraphView的generation/cleanup，不新增状态库。

按loading→error→成功渲染，标题计数同步受完成状态约束。文案：“正在检查反模式…”、“正在重新检查反模式…”、“反模式检查读取失败”、“未发现已检查规则覆盖的反模式”。沿用Semi UI，加入合适aria-busy/status，不将lint结论扩大为全部本体正确。

Node22与正确前端pnpm-lock；执行真实目标单测、typecheck、build及既有Playwright页面用例，用真实lint端点做只读冒烟。列明哪些用例是故障注入，记录路径、命令、实际数量/失败/skip，不写不存在测试路径或假通过。

仅本项web候选制品在已就绪隔离环境部署/核对revision/UI/回滚上一制品；云端仍需受信main、审核和required CI，不跳门禁。60分钟预算5/20/15/15/5，环境不足或超预算记录阻塞，不删测试、不改Accepted/Gate/GA。交一个引用本issue的小范围实施PR，返回文件/SHA/测试/候选与云端状态/回滚/耗时/未覆盖项。
