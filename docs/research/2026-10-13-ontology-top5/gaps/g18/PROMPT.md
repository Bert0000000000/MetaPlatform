# G18 执行 Prompt

只实施Bert0000000000/MetaPlatform的G18：对象类型导出接口拒绝未知format。先读最新main的AGENTS.md、本PRD、../../AUDIT-DELIVERY.md，核对当前代码和其他PR去重，在隔离分支保留WIP、数据库、预览和其他工作树。

基线dc8980d3e129e94f0bc55190705ede7cbe304ba0，定位mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py的export_object_type。当前仅turtle走专门分支，其他字符串静默返回jsonld。先读contracts/openapi/services/ont.yaml的真实operation/query schema及调用方，按项目规范明确jsonld/turtle枚举和未知参数4xx；优先沿既有422验证习惯。不预设兼容门禁已批准，不新增豁免。

先写失败测试：format省略仍默认jsonld，两合法值envelope/内容不变；owl/xml/yaml/拼错/空值/JSONLD明确拒绝，不序列化替代结果、不写数据库。合法格式的无身份和跨租户仍拒绝。非法格式与非法身份同时出现不规定先后，但不能泄漏数据。

用Literal/枚举或等价最小参数检查，保留已有成功响应和tenant ctx。不要未经契约声明添加别名/大小写归一，不扩展OWL/XML，不修G01–G04，不重写导出器、不改web/schema。业务说明可为“不支持该导出格式，仅支持jsonld、turtle”，结构化错误遵守既有规范。

Python3.12和正确后端uv.lock；运行实际目标pytest、必要契约bundle/lint/生成检查和required CI。真实候选端点用合成租户模型验证默认、turtle、未知值、跨租户及零写入，mock不代替真实权限/发布证据。兼容门禁阻塞时如实登记，不擅自放行。

一个ont候选制品独立发布至已就绪隔离环境，核对revision和实际API，再验证回滚上一制品；不依赖其他新工单。云端需受信main、审核、既有授权和required CI。60分钟有效预算5/20/15/15/5，环境不足或超预算不删测试、不谎报完成、不动共享资源/Accepted/Gate/GA。

交付一个引用本issue的小范围实施PR，返回文件、SHA、命令/数量/结果、契约检查、候选与云端部署状态、回滚、实际耗时和未覆盖边界。
