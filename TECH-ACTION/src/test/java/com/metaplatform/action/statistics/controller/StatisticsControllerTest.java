package com.metaplatform.action.statistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TraceFilter;
import com.metaplatform.action.statistics.dto.ActionStats;
import com.metaplatform.action.statistics.dto.ExecutionHistoryItem;
import com.metaplatform.action.statistics.dto.StatsOverview;
import com.metaplatform.action.statistics.dto.TimelinePoint;
import com.metaplatform.action.statistics.service.StatisticsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = StatisticsController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class StatisticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private StatisticsService statisticsService;

    @Test
    void overview_shouldReturnStats() throws Exception {
        long startTime = Instant.parse("2026-01-01T00:00:00Z").toEpochMilli();
        long endTime = Instant.parse("2026-01-02T00:00:00Z").toEpochMilli();
        StatsOverview overview = StatsOverview.builder()
                .totalExecutions(10)
                .successfulExecutions(8)
                .failedExecutions(2)
                .successRate(80.0)
                .avgDurationMs(120L)
                .build();
        when(statisticsService.getOverview(eq("tenant-default"), any(Instant.class), any(Instant.class)))
                .thenReturn(overview);

        mockMvc.perform(get("/api/v1/action/statistics/overview")
                        .param("startTime", String.valueOf(startTime))
                        .param("endTime", String.valueOf(endTime)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.totalExecutions").value(10))
                .andExpect(jsonPath("$.data.successRate").value(80.0));
    }

    @Test
    void byAction_shouldReturnActionStatsList() throws Exception {
        ActionStats stats = ActionStats.builder()
                .actionId("act-1")
                .actionName("sendNotification")
                .totalExecutions(5)
                .successRate(100.0)
                .avgDurationMs(80L)
                .build();
        when(statisticsService.getStatsByAction(anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(stats));

        mockMvc.perform(get("/api/v1/action/statistics/by-action"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].actionId").value("act-1"))
                .andExpect(jsonPath("$.data[0].totalExecutions").value(5));
    }

    @Test
    void timeline_shouldReturnPoints() throws Exception {
        TimelinePoint point = TimelinePoint.builder()
                .timestamp(Instant.parse("2026-01-01T00:00:00Z"))
                .executionCount(3)
                .successCount(2)
                .failureCount(1)
                .build();
        when(statisticsService.getTimeline(anyString(), any(), any(), eq("HOUR")))
                .thenReturn(List.of(point));

        mockMvc.perform(get("/api/v1/action/statistics/timeline")
                        .param("interval", "HOUR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].executionCount").value(3))
                .andExpect(jsonPath("$.data[0].successCount").value(2));
    }

    @Test
    void executions_shouldReturnPagedHistory() throws Exception {
        PageResponse<ExecutionHistoryItem> page = PageResponse.<ExecutionHistoryItem>builder()
                .items(List.of(ExecutionHistoryItem.builder()
                        .executionId("exec-1")
                        .actionId("act-1")
                        .actionName("sendNotification")
                        .status("COMPLETED")
                        .durationMs(100)
                        .build()))
                .total(1).page(1).size(20).totalPages(1).build();
        when(statisticsService.getExecutionHistory(anyString(), eq("act-1"), eq(null), anyInt(), anyInt()))
                .thenReturn(page);

        mockMvc.perform(get("/api/v1/action/statistics/executions")
                        .param("actionId", "act-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].executionId").value("exec-1"));
    }
}
