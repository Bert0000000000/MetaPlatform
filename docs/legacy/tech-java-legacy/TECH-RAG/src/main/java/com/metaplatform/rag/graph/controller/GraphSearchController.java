package com.metaplatform.rag.graph.controller;

import com.metaplatform.rag.common.ApiResponse;
import com.metaplatform.rag.graph.dto.GraphSearchRequest;
import com.metaplatform.rag.graph.dto.GraphSearchResponse;
import com.metaplatform.rag.graph.service.GraphSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rag/graph-search")
@RequiredArgsConstructor
public class GraphSearchController {

    private final GraphSearchService graphSearchService;

    @PostMapping
    public ApiResponse<GraphSearchResponse> search(@RequestBody GraphSearchRequest request) {
        return ApiResponse.ok(graphSearchService.search(request));
    }
}
