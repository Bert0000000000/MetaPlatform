package com.metaplatform.kb.controller;

import com.metaplatform.kb.common.ApiResponse;
import com.metaplatform.kb.common.TenantContext;
import com.metaplatform.kb.entity.KbDocumentEntity;
import com.metaplatform.kb.service.KbEmbeddingService;
import com.metaplatform.kb.service.KbService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 文档 REST API（P2.1.3）。
 *
 * <ul>
 *   <li>POST /api/v1/kb/documents — 上传（前端已直传 MinIO，此处仅落元数据）</li>
 *   <li>GET  /api/v1/kb/documents?kbId=...</li>
 *   <li>GET  /api/v1/kb/documents/{id}</li>
 *   <li>POST /api/v1/kb/documents/{id}/process — 触发处理流水线</li>
 *   <li>POST /api/v1/kb/documents/{id}/embed — 触发向量化</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/kb/documents")
@RequiredArgsConstructor
public class DocumentsController {

    private final KbService kbService;
    private final KbEmbeddingService embeddingService;

    @PostMapping
    public ApiResponse<KbDocumentEntity> upload(@RequestBody KbDocumentEntity doc) {
        doc.setTenantId(TenantContext.tenantIdOrDefault());
        return ApiResponse.success(kbService.uploadDocument(doc));
    }

    @GetMapping
    public ApiResponse<List<KbDocumentEntity>> list(@RequestParam String kbId) {
        return ApiResponse.success(kbService.listDocuments(kbId));
    }

    @GetMapping("/{id}")
    public ApiResponse<KbDocumentEntity> get(@PathVariable String id) {
        return ApiResponse.success(kbService.getDocument(id));
    }

    @PostMapping("/{id}/process")
    public ApiResponse<KbDocumentEntity> process(@PathVariable String id,
                                                  @RequestBody Map<String, String> body) {
        // body: { "rawContent": "..." } — 解析后的纯文本
        // 实际生产：解析由 K8s Job / Sandbox 完成，结果回调此处
        return ApiResponse.success(kbService.triggerProcess(id));
    }

    @PostMapping("/{id}/embed")
    public ApiResponse<Map<String, Object>> embed(@PathVariable String id) {
        int done = embeddingService.embedDocumentChunks(id);
        return ApiResponse.success(Map.of("documentId", id, "embeddedChunks", done));
    }
}
