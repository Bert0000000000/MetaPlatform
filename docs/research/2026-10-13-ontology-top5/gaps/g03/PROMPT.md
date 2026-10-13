# G03 执行 Prompt v2 / Issue #120

在 Bert0000000000/MetaPlatform 只实施 G03：JSON-LD 属性业务标题往返，并保证标题修改不改变 Turtle 属性身份。本版本替代旧 Prompt 的实现细节，不另建重复工单。

先读最新 main 的 AGENTS.md、本目录 PRD.md、../../AUDIT-DELIVERY.md，建隔离分支，保留 WIP/工作树/数据库/预览。调研基线 dc8980d3e129e94f0bc55190705ede7cbe304ba0；先核对当前代码/PR，已修复则提供证据不重复改动。

定位 mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py。关键陷阱：props[].schema:name 目前是 property_slug，import 用它作为 title；直接改成 p.title 会影响 Turtle 分支的属性主语。JSON-LD schema:name 取有效 title、缺失按现有规范 fallback；Turtle 身份必须从原 property RID 用既有 property_slug 取得，不能由 title 生成。不新增公共内部字段，不重写 RID 解析。

先写失败测试：同一属性 RID 使用两种含中文/空格/标点的 title，JSON-LD 名称变化而 @id/Turtle 属性主语集合不变；用已有 RDF parser 检查 term。测试类型名称保持简单，用当前可解析 fixture，不依赖 G01。补空标题、含领域/无领域RID、主键/type_id/nullable与旧文件兼容回归。

独立非特权 PG16 上用合成模型实际创建→导出→回灌→同租户GET读回，跨租户仍拒绝。不得在生产模型做实验，不宣称完整 metadata/parent/format 无损往返。Python3.12与正确后端uv.lock；先核对ont.yaml及消费者，再运行真实目标pytest、必要PG门禁/契约检查/required CI，记录命令和执行数量，缺环境/skip不记通过。

只交付这个后端切面；不改web或schema，不重复#113。单项ont候选制品在预热隔离目标发布并核对revision、行为和回滚；云端必须经受信main和批准的发布流程，不绕过门禁。60分钟有效预算5/20/15/15/5，条件不足或超预算如实登记。保留共享资源，不改Accepted/Gate/GA。

交付引用#120的一个小范围实施PR，返回文件、SHA、真实测试结果、候选/云端部署状态、回滚证据、耗时及未覆盖项。文档完成不等于功能完成。
