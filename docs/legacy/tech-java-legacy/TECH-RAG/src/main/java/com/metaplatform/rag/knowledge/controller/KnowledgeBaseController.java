package com.metaplatform.rag.knowledge.controller;

import com.metaplatform.rag.common.ApiResponse;
import com.metaplatform.rag.knowledge.dto.CreateKnowledgeBaseRequest;
import com.metaplatform.rag.knowledge.dto.KnowledgeBaseDto;
import com.metaplatform.rag.knowledge.dto.RetrievalConfigDto;
import com.metaplatform.rag.knowledge.service.KnowledgeBaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rag/knowledge-bases")
@RequiredArgsConstructor
public class KnowledgeBaseController {

    private final KnowledgeBaseService knowledgeBaseService;

    @GetMapping
    public ApiResponse<List<KnowledgeBaseDto>> listAll() {
        return ApiResponse.ok(knowledgeBaseService.listAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<KnowledgeBaseDto> getById(@PathVariable UUID id) {
        return ApiResponse.ok(knowledgeBaseService.getById(id));
    }

    @PostMapping
    public ApiResponse<KnowledgeBaseDto> create(@Valid @RequestBody CreateKnowledgeBaseRequest request) {
        return ApiResponse.ok(knowledgeBaseService.create(request, "system"));
    }

    @PutMapping("/{id}")
    public ApiResponse<KnowledgeBaseDto> update(@PathVariable UUID id, @Valid @RequestBody CreateKnowledgeBaseRequest request) {
        return ApiResponse.ok(knowledgeBaseService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        knowledgeBaseService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/permissions")
    public ApiResponse<List<Object>> getPermissions(@PathVariable UUID id) {
        return ApiResponse.ok(Collections.emptyList());
    }

    @GetMapping("/{id}/versions")
    public ApiResponse<List<Object>> getVersions(@PathVariable UUID id) {
        return ApiResponse.ok(Collections.emptyList());
    }

    @GetMapping("/{id}/metrics")
    public ApiResponse<Map<String, Object>> getMetrics(@PathVariable UUID id) {
        return ApiResponse.ok(Map.of(
            "kbId", id,
            "documentCount", 0,
            "chunkCount", 0,
            "searchCount", 0
        ));
    }

    @PutMapping("/{id}/retrieval-config")
    public ApiResponse<KnowledgeBaseDto> updateRetrievalConfig(@PathVariable UUID id, @RequestBody RetrievalConfigDto config) {
        return ApiResponse.ok(knowledgeBaseService.updateRetrievalConfig(id, config));
    }
}
