package com.metaplatform.ragmdm.api;

import com.metaplatform.ragmdm.api.dto.RagQueryRequest;
import com.metaplatform.ragmdm.rag.RagQueryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rag")
@RequiredArgsConstructor
public class RagController {

    private final RagQueryService ragQueryService;

    @PostMapping("/query")
    public List<RagQueryService.RagSearchResult> query(
            @Valid @RequestBody RagQueryRequest request) {
        return ragQueryService.query(
            request.getQuery(),
            request.getKnowledgeBaseId(),
            request.getTopK()
        );
    }

    @PostMapping("/query-with-context")
    public List<RagQueryService.RagSearchResult> queryWithContext(
            @Valid @RequestBody RagQueryRequest request) {
        return ragQueryService.queryWithContext(
            request.getQuery(),
            request.getKnowledgeBaseId(),
            request.getTopK()
        );
    }
}
