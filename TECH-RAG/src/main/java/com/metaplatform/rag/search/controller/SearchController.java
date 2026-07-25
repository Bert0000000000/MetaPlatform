package com.metaplatform.rag.search.controller;

import com.metaplatform.rag.common.ApiResponse;
import com.metaplatform.rag.search.dto.SearchRequest;
import com.metaplatform.rag.search.dto.SearchResponse;
import com.metaplatform.rag.search.dto.SearchResult;
import com.metaplatform.rag.search.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rag/knowledge-bases/{kbId}/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @PostMapping
    public ApiResponse<SearchResponse> search(@PathVariable UUID kbId, @RequestBody SearchRequest request) {
        return ApiResponse.ok(searchService.search(kbId, request));
    }

    @PostMapping("/hybrid")
    public ApiResponse<SearchResponse> hybridSearch(@PathVariable UUID kbId, @RequestBody SearchRequest request) {
        return ApiResponse.ok(searchService.hybridSearch(kbId, request));
    }

    @PostMapping(value = "/stream", produces = "text/event-stream")
    public Flux<SearchResult> streamSearch(@PathVariable UUID kbId, @RequestBody SearchRequest request) {
        return searchService.streamSearch(kbId, request);
    }

    @PostMapping("/feedback")
    public ApiResponse<Void> feedback(
        @PathVariable UUID kbId,
        @RequestBody Map<String, Object> body
    ) {
        UUID chunkId = body.get("chunkId") != null ? UUID.fromString(body.get("chunkId").toString()) : null;
        String query = body.get("query") != null ? body.get("query").toString() : null;
        Double score = body.get("score") != null ? Double.valueOf(body.get("score").toString()) : null;
        String feedbackType = body.get("feedbackType") != null ? body.get("feedbackType").toString() : null;
        String comment = body.get("comment") != null ? body.get("comment").toString() : null;
        searchService.saveFeedback(kbId, chunkId, query, score, feedbackType, comment);
        return ApiResponse.ok();
    }
}
