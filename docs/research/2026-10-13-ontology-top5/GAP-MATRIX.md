# 确认差距与独立工单索引

基线：`dc8980d3e129e94f0bc55190705ede7cbe304ba0`。以下 16 项是本轮确认且有局部独立交付路径的差距；不是完整 OWL2 平台迁移计划。每项一份 PRD、一份可复制执行 prompt、一个 ZIP 附件。优先处理 P1；原云端 #111–#117 继续留在原票，不重复登记。

| ID | 优先级 | 工单 | 独立部署单元 | PRD | Prompt |
|---|---|---|---|---|---|
| G01 | P1 | Turtle 导出正确转义业务名称，特殊字符可重新解析 | ont | [PRD](gaps/g01/PRD.md) | [Prompt](gaps/g01/PROMPT.md) |
| G02 | P1 | JSON-LD 导出显式声明 ont 扩展词汇命名空间 | ont | [PRD](gaps/g02/PRD.md) | [Prompt](gaps/g02/PROMPT.md) |
| G03 | P1 | 类型 JSON-LD 往返保留属性业务标题 | ont | [PRD](gaps/g03/PRD.md) | [Prompt](gaps/g03/PROMPT.md) |
| G04 | P2 | 导入导出页提供既有 Turtle 下载选项 | web | [PRD](gaps/g04/PRD.md) | [Prompt](gaps/g04/PROMPT.md) |
| G05 | P1 | JSON 文件导入前展示摘要并要求明确确认 | web | [PRD](gaps/g05/PRD.md) | [Prompt](gaps/g05/PROMPT.md) |
| G06 | P2 | 导入导出页区分类型加载失败与空列表并支持重试 | web | [PRD](gaps/g06/PRD.md) | [Prompt](gaps/g06/PROMPT.md) |
| G07 | P1 | SHACL 类型切换立即清空旧报告并拒绝迟到响应 | web | [PRD](gaps/g07/PRD.md) | [Prompt](gaps/g07/PROMPT.md) |
| G08 | P2 | SHACL 页面可下载当前目标的完整 JSON 校验报告 | web | [PRD](gaps/g08/PRD.md) | [Prompt](gaps/g08/PROMPT.md) |
| G09 | P1 | 公理校验明确展示未执行及部分覆盖，不以绿色标记代替全覆盖 | web | [PRD](gaps/g09/PRD.md) | [Prompt](gaps/g09/PROMPT.md) |
| G10 | P2 | 模型工作台图谱布局缓存按用户和租户隔离 | web | [PRD](gaps/g10/PRD.md) | [Prompt](gaps/g10/PROMPT.md) |
| G11 | P2 | 模型工作台搜索可命中业务说明和属性标题 | web | [PRD](gaps/g11/PRD.md) | [Prompt](gaps/g11/PROMPT.md) |
| G12 | P2 | 模型属性检查器展示直接父类并可点击定位 | web | [PRD](gaps/g12/PRD.md) | [Prompt](gaps/g12/PROMPT.md) |
| G13 | P1 | SPARQL 兼容端点明确拒绝未执行的 INSERT/DELETE | ont | [PRD](gaps/g13/PRD.md) | [Prompt](gaps/g13/PROMPT.md) |
| G14 | P1 | SPARQL 简化解析器对 FILTER/OPTIONAL 明确报不支持 | ont | [PRD](gaps/g14/PRD.md) | [Prompt](gaps/g14/PROMPT.md) |
| G15 | P2 | SHACL 报告按真实 severity 展示 Warning 和 Info | web | [PRD](gaps/g15/PRD.md) | [Prompt](gaps/g15/PROMPT.md) |
| G16 | P2 | 候选证据旁可查看所引用来源列的统计摘要 | web | [PRD](gaps/g16/PRD.md) | [Prompt](gaps/g16/PROMPT.md) |
