package com.metaplatform.rag.controller;

import com.metaplatform.kb.entity.KbRetrievalConfigEntity;
import com.metaplatform.kb.entity.KbRetrievalConfigRepository;
import com.metaplatform.rag.common.ApiResponse;
import com.metaplatform.rag.evidence.Evidence;
import com.metaplatform.rag.hybrid.HybridSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * TECH-RAG controller surface.
 */
@RestController
@RequestMapping("/api/v1/rag")
@RequiredArgsConstructor
public class RagController {

    private final HybridSearchService searchService;
    private final KbRetrievalConfigRepository retrievalConfigRepository;

    @PostMapping("/search")
    public ApiResponse<List<Evidence>> search(@RequestBody SearchRequest req) {
        KbRetrievalConfigEntity cfg = null;
        return ApiResponse.success(searchService.search(req.tenantId, req.query, cfg));
    }

    @PostMapping("/retrieve")
    public ApiResponse<List<Evidence>> retrieve(@RequestBody RetrieveRequest req) {
        KbRetrievalConfigEntity cfg = null;
        return ApiResponse.success(searchService.search(req.tenantId, req.query, cfg));
    }

    @PostMapping("/embed")
    public ApiResponse<Map<String, Object>> embed(@RequestBody EmbedRequest req) {
        return ApiResponse.success(Map.of("dim", 1024, "ok", true));
    }

    @lombok.Data @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class SearchRequest { private String tenantId; private String kbId; private String query; }

    @lombok.Data @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class RetrieveRequest { private String tenantId; private String kbId; private String query; }

    @lombok.Data @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class EmbedRequest { private String tenantId; private String text; }
}