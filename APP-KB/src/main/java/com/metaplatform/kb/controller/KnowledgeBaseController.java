package com.metaplatform.kb.controller;

import com.metaplatform.kb.common.ApiResponse;
import com.metaplatform.kb.common.TenantContext;
import com.metaplatform.kb.entity.*;
import com.metaplatform.kb.service.KbService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * KB 主数据 REST API（P2.1.2）。
 *
 * <ul>
 *   <li>POST   /api/v1/kb/knowledge-bases</li>
 *   <li>GET    /api/v1/kb/knowledge-bases</li>
 *   <li>GET    /api/v1/kb/knowledge-bases/{id}</li>
 *   <li>PUT    /api/v1/kb/knowledge-bases/{id}</li>
 *   <li>DELETE /api/v1/kb/knowledge-bases/{id}</li>
 *   <li>POST   /api/v1/kb/bindings</li>
 *   <li>GET    /api/v1/kb/bindings</li>
 *   <li>PUT    /api/v1/kb/retrieval-configs</li>
 *   <li>GET    /api/v1/kb/retrieval-configs/{kbId}</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/kb")
@RequiredArgsConstructor
public class KnowledgeBaseController {

    private final KbService kbService;

    @PostMapping("/knowledge-bases")
    public ApiResponse<KbEntity> createKb(@RequestBody KbEntity entity) {
        entity.setTenantId(TenantContext.tenantIdOrDefault());
        return ApiResponse.success(kbService.createKb(entity));
    }

    @GetMapping("/knowledge-bases")
    public ApiResponse<List<KbEntity>> listKb() {
        return ApiResponse.success(kbService.listKb(TenantContext.tenantIdOrDefault()));
    }

    @GetMapping("/knowledge-bases/{id}")
    public ApiResponse<KbEntity> getKb(@PathVariable String id) {
        return ApiResponse.success(kbService.getKb(id));
    }

    @PutMapping("/knowledge-bases/{id}")
    public ApiResponse<KbEntity> updateKb(@PathVariable String id, @RequestBody KbEntity patch) {
        return ApiResponse.success(kbService.updateKb(id, patch));
    }

    @DeleteMapping("/knowledge-bases/{id}")
    public ApiResponse<Void> deleteKb(@PathVariable String id) {
        kbService.deleteKb(id);
        return ApiResponse.success();
    }

    @PostMapping("/bindings")
    public ApiResponse<KbBindingEntity> createBinding(@RequestBody KbBindingEntity b) {
        b.setTenantId(TenantContext.tenantIdOrDefault());
        return ApiResponse.success(kbService.createBinding(b));
    }

    @GetMapping("/bindings")
    public ApiResponse<List<KbBindingEntity>> listBindings(@RequestParam String bindType,
                                                            @RequestParam String bindKey) {
        return ApiResponse.success(kbService.findBindings(
                TenantContext.tenantIdOrDefault(), bindType, bindKey));
    }

    @PutMapping("/retrieval-configs")
    public ApiResponse<KbRetrievalConfigEntity> upsertRetrievalConfig(@RequestBody KbRetrievalConfigEntity cfg) {
        cfg.setTenantId(TenantContext.tenantIdOrDefault());
        return ApiResponse.success(kbService.upsertRetrievalConfig(cfg));
    }

    @GetMapping("/retrieval-configs/{kbId}")
    public ApiResponse<KbRetrievalConfigEntity> getRetrievalConfig(@PathVariable String kbId) {
        return ApiResponse.success(kbService.getRetrievalConfig(
                TenantContext.tenantIdOrDefault(), kbId));
    }
}
