package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.GraphQueryRequest;
import com.metaplatform.ont.dto.GraphQueryResponse;
import com.metaplatform.ont.dto.GraphStatsResponse;
import com.metaplatform.ont.service.GraphQueryService;
import com.metaplatform.ont.service.GraphStatsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ont/graph")
@RequiredArgsConstructor
public class GraphController {

    private final GraphQueryService graphQueryService;
    private final GraphStatsService graphStatsService;

    @PostMapping("/query")
    public ApiResponse<GraphQueryResponse> query(@Valid @RequestBody GraphQueryRequest request) {
        return ApiResponse.success(graphQueryService.query(request));
    }

    @GetMapping("/stats")
    public ApiResponse<GraphStatsResponse> stats(@RequestParam String tenantId) {
        return ApiResponse.success(graphStatsService.getStats(tenantId));
    }
}
