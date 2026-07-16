package com.metaplatform.msg.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.msg.common.ErrorCode;
import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.OutboxResponse;
import com.metaplatform.msg.dto.OutboxStatsResponse;
import com.metaplatform.msg.service.OutboxService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(OutboxController.class)
@AutoConfigureMockMvc(addFilters = false)
class OutboxControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OutboxService outboxService;

    @Test
    void getStats_shouldReturn200_withCorrectCounts() throws Exception {
        OutboxStatsResponse stats = OutboxStatsResponse.builder()
                .pending(5)
                .sent(10)
                .failed(2)
                .total(17)
                .build();

        when(outboxService.getStats()).thenReturn(stats);

        mockMvc.perform(get("/api/v1/msg/outbox/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.pending").value(5))
                .andExpect(jsonPath("$.data.sent").value(10))
                .andExpect(jsonPath("$.data.failed").value(2))
                .andExpect(jsonPath("$.data.total").value(17));
    }

    @Test
    void listOutbox_shouldReturn200_withPagedResults() throws Exception {
        OutboxResponse response = OutboxResponse.builder()
                .id("msg-1")
                .tenantId("tenant-default")
                .aggregateType("User")
                .aggregateId("user-1")
                .eventType("USER_REGISTERED")
                .status("PENDING")
                .retryCount(0)
                .maxRetries(3)
                .createdAt(Instant.now())
                .headers(new HashMap<>())
                .payload(new HashMap<>())
                .build();

        PageResponse<OutboxResponse> page = PageResponse.<OutboxResponse>builder()
                .items(List.of(response))
                .total(1)
                .page(1)
                .size(20)
                .totalPages(1)
                .build();

        when(outboxService.listOutbox(anyString(), anyInt(), anyInt())).thenReturn(page);

        mockMvc.perform(get("/api/v1/msg/outbox")
                        .param("status", "PENDING")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.items[0].id").value("msg-1"))
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void retry_shouldReturn200_whenRetrySucceeds() throws Exception {
        when(outboxService.retry("msg-1")).thenReturn(true);

        mockMvc.perform(post("/api/v1/msg/outbox/msg-1/retry")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.outboxId").value("msg-1"))
                .andExpect(jsonPath("$.data.currentStatus").value("PENDING"));
    }
}
