package com.metaplatform.mcp.audit.controller;

import com.metaplatform.mcp.audit.dto.AnalyticsItem;
import com.metaplatform.mcp.audit.dto.AuditLogResponse;
import com.metaplatform.mcp.audit.dto.AuditLogStatistics;
import com.metaplatform.mcp.audit.dto.TrendPoint;
import com.metaplatform.mcp.audit.service.McpAuditService;
import com.metaplatform.mcp.common.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(McpAuditController.class)
class McpAuditControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpAuditService auditService;

    private AuditLogResponse sample(UUID id) {
        return AuditLogResponse.builder()
                .id(id).toolCode("tool-1").invocationType("DIRECT")
                .inputTokens(10).outputTokens(20).durationMs(100L)
                .status("SUCCESS").calledAt(Instant.now()).build();
    }

    @Test
    void list_returns_page() throws Exception {
        when(auditService.query(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(PageResponse.<AuditLogResponse>builder()
                        .items(List.of(sample(UUID.randomUUID())))
                        .total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/audit/logs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].toolCode").value("tool-1"));
    }

    @Test
    void get_returns_log() throws Exception {
        UUID id = UUID.randomUUID();
        when(auditService.get(id)).thenReturn(sample(id));

        mockMvc.perform(get("/api/v1/mcp/audit/logs/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void statistics_returns_summary() throws Exception {
        when(auditService.statistics(any(), any()))
                .thenReturn(AuditLogStatistics.builder()
                        .totalCalls(10).successCount(8).failureCount(2)
                        .successRate(0.8).avgDuration(50.0)
                        .totalInputTokens(100).totalOutputTokens(200).totalTokens(300)
                        .byStatus(Map.of("SUCCESS", 8L, "FAILED", 2L))
                        .build());

        mockMvc.perform(get("/api/v1/mcp/audit/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalCalls").value(10))
                .andExpect(jsonPath("$.data.successRate").value(0.8));
    }

    @Test
    void trends_returns_series() throws Exception {
        when(auditService.trends(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(TrendPoint.builder().time(Instant.now()).count(5L).build()));

        mockMvc.perform(get("/api/v1/mcp/audit/trends").param("granularity", "hour"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].count").value(5));
    }

    @Test
    void analytics_returns_items() throws Exception {
        when(auditService.analytics(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(AnalyticsItem.builder()
                        .dimension("tool").dimensionKey("tool-1").count(10).errorCount(1).tokenCount(100).avgDuration(50.0)
                        .build()));

        mockMvc.perform(get("/api/v1/mcp/audit/analytics").param("dimension", "tool"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].dimensionKey").value("tool-1"));
    }

    @Test
    void trace_returns_chain() throws Exception {
        UUID id = UUID.randomUUID();
        when(auditService.trace(id)).thenReturn(List.of(sample(id)));

        mockMvc.perform(get("/api/v1/mcp/audit/{id}/trace", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].toolCode").value("tool-1"));
    }

    @Test
    void export_returns_csv_attachment() throws Exception {
        when(auditService.export(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn("id,tool_code\n1,tool-1".getBytes());

        mockMvc.perform(get("/api/v1/mcp/audit/export").param("format", "csv"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("attachment")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("tool-1")));
    }

    @Test
    void export_returns_xlsx_attachment() throws Exception {
        when(auditService.export(any(), any(), any(), any(), any(), any(), eq("xlsx")))
                .thenReturn(new byte[]{0x50, 0x4B});

        mockMvc.perform(get("/api/v1/mcp/audit/export").param("format", "xlsx"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString(".xlsx")))
                .andExpect(content().contentTypeCompatibleWith(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    }
}
