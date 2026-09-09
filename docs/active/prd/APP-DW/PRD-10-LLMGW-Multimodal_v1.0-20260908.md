# PRD-10 llmgw 多模态（图像/语音/视频）
> 版本: v1.0 · 日期: 2026-09-08 · 状态: [ ] Not Started（chat/multimodal 路由已存在于 routes.py，需 MultimodalEngine 对接 ARK/MiniMax vision 端点 + 测试）
> 关联: routes.py POST /chat/multimodal / Sprint 4
> FR: FR-MM-001..004

## 范围
FR-MM-001 图像理解（base64/URL 传入 → 描述/OCR/标注）
FR-MM-002 语音转写（audio → text）
FR-MM-003 视频摘要（video → summary）
FR-MM-004 配额/计费（与文本 chat 共用 quota/cost 体系）
