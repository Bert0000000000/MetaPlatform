# G03 PRD v2：属性业务标题往返，不改变技术标识

2026-10-13 · P1 · ont 应用增量 · 有效工作预算60分钟 · 待实施。
本版本修订现有 Issue #120，不新建重复工单。与历史 ZIP 有冲突时，以本 v2 和本次 Issue 补充为准。

## 问题与证据

MetaPlatform 基线 dc8980d3e129e94f0bc55190705ede7cbe304ba0。定位 mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py 的 export_object_type/import_object_type。导出 schema:name 取 property_slug，导入以它回填 title，业务标题因此丢失。原 PRD 只建议把 schema:name 改为 p.title，但同一 props 列表还被 Turtle 分支复用，属性主语直接使用 pr['schema:name']。仅改该字段会把可编辑标题变成技术标识，含空格或符号时还可能破坏语法。

对标 TrustGraph exporter 将 propId 与 label 分离；参考的是身份与展示分离原则，不代表其所有格式全语义保真。固定对标代码见 ../../AUDIT.md。

## 用户与目标

业务建模者导出、回灌合成模型后，属性中文标题一致；修改标题不产生另一个 RDF 属性。JSON-LD 的 schema:name 优先采用有效 p.title，空标题按已有规范回退 property_slug。Turtle 属性主语仍从原 property RID 通过现有 property_slug 取得，不能从业务标题构造。可在 Turtle 分支从 @id 重新取规范 slug；不要新增公共临时字段或手写点号 RID 解析。

## 范围边界与操作

只闭合标题往返及本次改动不得破坏的 Turtle 身份不变量。保留 envelope、@id、primary_key、type_id、nullable 与权限行为；不改完整 IRI 映射、父类/关系/format/unit/metadata 往返，不依赖 G01/G02，不重复 #113 的实例列归一。

独立合成类型：简单类型名称、规范属性 RID，title='客户 名称（含备注）'。操作为创建→导出 JSON-LD→回灌→同租户重新 GET 读回。再改变同 RID 属性的业务标题并导出 Turtle，两次属性主语必须相同。测试 fixture 选择当前已能解析的普通类名，不能等 G01 完成才能验收。此为后端修复，不新增 UI；成功文案不得宣称完整本体无损恢复。

## 验收和独立测试

- [ ] 含领域/不含领域 RID、中文/空格/标点标题和空标题 fallback 均有用例。
- [ ] 同 RID 两种标题：JSON-LD schema:name 改变，@id 与 Turtle 属性主语集合不变。
- [ ] 用现有 RDF 解析器重新解析普通 fixture 的 Turtle，验证 RDF term，不只比较包含字符串。
- [ ] 真实独立非特权 PG16 完成创建→导出→回灌→GET 读回标题；跨租户仍拒绝。
- [ ] primary_key/type_id/nullable 不漂移，旧文件仍可读取，不额外承诺原未保真字段。

先写失败测试，再做最小实现；先核对 ont.yaml、消费者与必要契约描述。实际命令/路径/数量/失败/skip 单独记录，mock 不能替代数据库验收。

## 独立部署、回滚和完成定义

一个 ont 实施 PR，零 schema 迁移，不需 web 或其他本批工单先升级。预热隔离候选环境发布本项制品，核对 revision、API 往返及 Turtle 身份；回滚上一应用制品。只操作合成模型，不对生产模型进行有损 round-trip，不重置数据库或卷。

预算5分钟复现、20分钟实现、15分钟测试、15分钟候选发布/回滚、5分钟证据。环境/CI等待不承诺60分钟墙钟，云端仍需受信 main、审核与 required CI。没有发布证据不能记 Done。详见 ../../AUDIT-DELIVERY.md；执行提示见 PROMPT.md。
