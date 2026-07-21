package com.metaplatform.mcp.alert.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.alert.dto.AlertRuleResponse;
import com.metaplatform.mcp.alert.dto.CreateAlertRuleRequest;
import com.metaplatform.mcp.alert.service.McpAlertRuleService;
import com.metaplatform.mcp.common.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(McpAlertRuleController.class)
class McpAlertRuleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private McpAlertRuleService alertRuleService;

    private AlertRuleResponse sample() {
        return AlertRuleResponse.builder()
                .id(UUID.randomUUID())
                .name("失败率告警")
                .metric("error_rate")
                .threshold(BigDecimal.valueOf(0.05))
                .windowMinutes(5)
                .enabled(true)
                .notifyChannels(List.of("email"))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void list_returns_page() throws Exception {
        when(alertRuleService.list(any(), any(), any()))
                .thenReturn(PageResponse.<AlertRuleResponse>builder()
                        .items(List.of(sample()))
                        .total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/alert-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].name").value("失败率告警"));
    }

    @Test
    void create_returns_rule() throws Exception {
        CreateAlertRuleRequest request = CreateAlertRuleRequest.builder()
                .name("失败率告警")
                .metric("error_rate")
                .threshold(BigDecimal.valueOf(0.05))
                .windowMinutes(5)
                .enabled(true)
                .notifyChannels(List.of("email"))
                .build();
        when(alertRuleService.create(any())).thenReturn(sample());

        mockMvc.perform(post("/api/v1/mcp/alert-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metric").value("error_rate"));
    }

    @Test
    void toggle_returns_updated_rule() throws Exception {
        AlertRuleResponse updated = sample();
        updated.setEnabled(false);
        when(alertRuleService.toggle(any(), eq(false))).thenReturn(updated);

        mockMvc.perform(patch("/api/v1/mcp/alert-rules/{id}/enabled", UUID.randomUUID())
                        .param("enabled", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false));
    }
}
