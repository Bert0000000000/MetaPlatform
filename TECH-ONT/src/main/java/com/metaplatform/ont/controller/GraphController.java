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

    /**
     * 图谱查询（REQ-030, REQ-032, REQ-034）。
     * 支持以 startNodeId 或自然语言 query 作为起点；
     * 支持 nodeTypes / properties / tags 筛选；支持 depth 跳数扩展。
     */
    @PostMapping("/query")
    public ApiResponse<GraphQueryResponse> query(@Valid @RequestBody GraphQueryRequest request) {
        return ApiResponse.success(graphQueryService.query(request));
    }

    /**
     * 节点展开（REQ-035）：返回某节点的 N 跳邻居子图。
     * 用于前端 KnowledgeGraph 点击节点时增量加载子节点。
     */
    @GetMapping("/expand")
    public ApiResponse<GraphQueryResponse> expand(@RequestParam String nodeId,
                                                  @RequestParam(defaultValue = "1") int depth) {
        return ApiResponse.success(graphQueryService.expand(nodeId, depth));
    }

    @GetMapping("/stats")
    public ApiResponse<GraphStatsResponse> stats(@RequestParam String tenantId) {
        return ApiResponse.success(graphStatsService.getStats(tenantId));
    }
}
