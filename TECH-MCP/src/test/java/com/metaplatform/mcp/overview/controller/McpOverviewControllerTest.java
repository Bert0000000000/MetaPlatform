package com.metaplatform.mcp.overview.controller;

import com.metaplatform.mcp.overview.dto.OverviewResponse;
import com.metaplatform.mcp.overview.service.McpOverviewService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(McpOverviewController.class)
class McpOverviewControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpOverviewService overviewService;

    @Test
    void overview_returns_aggregated_payload() throws Exception {
        OverviewResponse response = OverviewResponse.builder()
                .serverStats(OverviewResponse.ServerStats.builder()
                        .total(3).online(2).offline(1).error(0).build())
                .toolStats(OverviewResponse.ToolStats.builder()
                        .total(5).enabled(3).disabled(2).build())
                .callStats(OverviewResponse.CallStats.builder()
                        .todayCalls(10).successRate(0.8).avgDuration(75.0).build())
                .tokenStats(OverviewResponse.TokenStats.builder()
                        .todayInputTokens(100).todayOutputTokens(200).todayTotalTokens(300).build())
                .errorAlerts(List.of(OverviewResponse.ErrorAlert.builder()
                        .id("alert-1").toolCode("tool-1").status("FAILED")
                        .level("error").errorMessage("boom").calledAt("2026-07-20T00:00:00Z")
                        .traceId("trace-1").build()))
                .topTools(List.of(OverviewResponse.TopTool.builder()
                        .toolCode("tool-1").count(5L).build()))
                .callTrend(List.of(OverviewResponse.TrendPoint.builder()
                        .time("2026-07-20T00:00:00Z").count(4L).tokens(0L).build()))
                .tokenTrend(List.of(OverviewResponse.TrendPoint.builder()
                        .time("2026-07-20T00:00:00Z").count(4L).tokens(120L).build()))
                .build();

        when(overviewService.overview()).thenReturn(response);

        mockMvc.perform(get("/api/v1/mcp/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.serverStats.total").value(3))
                .andExpect(jsonPath("$.data.serverStats.online").value(2))
                .andExpect(jsonPath("$.data.toolStats.total").value(5))
                .andExpect(jsonPath("$.data.callStats.todayCalls").value(10))
                .andExpect(jsonPath("$.data.callStats.successRate").value(0.8))
                .andExpect(jsonPath("$.data.tokenStats.todayTotalTokens").value(300))
                .andExpect(jsonPath("$.data.errorAlerts[0].toolCode").value("tool-1"))
                .andExpect(jsonPath("$.data.topTools[0].count").value(5))
                .andExpect(jsonPath("$.data.callTrend[0].count").value(4))
                .andExpect(jsonPath("$.data.tokenTrend[0].tokens").value(120));
    }
}
