package com.metaplatform.mcp.overview.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.overview.dto.OverviewResponse;
import com.metaplatform.mcp.overview.service.McpOverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * MCP Hub 概览页接口。
 *
 * <p>GET /api/v1/mcp/overview 返回 Server 状态/工具总数/今日调用/Token 消耗/近期错误告警/Top Tools。</p>
 */
@RestController
@RequestMapping("/api/v1/mcp/overview")
@RequiredArgsConstructor
public class McpOverviewController {

    private final McpOverviewService overviewService;

    @GetMapping
    public ApiResponse<OverviewResponse> overview() {
        return ApiResponse.success(overviewService.overview());
    }
}
