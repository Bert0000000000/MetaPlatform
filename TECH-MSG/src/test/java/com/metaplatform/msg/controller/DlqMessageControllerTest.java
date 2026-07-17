package com.metaplatform.msg.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.BatchResendRequest;
import com.metaplatform.msg.dto.BatchResendResponse;
import com.metaplatform.msg.dto.DlqMessageResponse;
import com.metaplatform.msg.service.DlqMessageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DlqMessageController.class)
@AutoConfigureMockMvc(addFilters = false)
class DlqMessageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DlqMessageService dlqMessageService;

    @Test
    void list_shouldReturn200_withPagedResults() throws Exception {
        DlqMessageResponse response = DlqMessageResponse.builder()
                .id("dlq-1")
                .tenantId("tenant-default")
                .originalTopic("test-topic")
                .status("PENDING")
                .retryCount(0)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        PageResponse<DlqMessageResponse> page = PageResponse.<DlqMessageResponse>builder()
                .items(List.of(response))
                .total(1)
                .page(1)
                .size(20)
                .totalPages(1)
                .build();

        when(dlqMessageService.list(any(), any(), any(), anyInt(), anyInt())).thenReturn(page);

        mockMvc.perform(get("/api/v1/msg/dlq")
                        .param("topic", "test-topic")
                        .param("status", "PENDING")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.items[0].id").value("dlq-1"))
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void getById_shouldReturn200_whenMessageExists() throws Exception {
        DlqMessageResponse response = DlqMessageResponse.builder()
                .id("dlq-1")
                .originalTopic("test-topic")
                .status("PENDING")
                .retryCount(0)
                .build();

        when(dlqMessageService.getById("dlq-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/msg/dlq/dlq-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("dlq-1"))
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    @Test
    void resend_shouldReturn200_whenResendSucceeds() throws Exception {
        DlqMessageResponse response = DlqMessageResponse.builder()
                .id("dlq-1")
                .originalTopic("test-topic")
                .status("RESENT")
                .retryCount(0)
                .build();

        when(dlqMessageService.resend("dlq-1")).thenReturn(response);

        mockMvc.perform(post("/api/v1/msg/dlq/dlq-1/resend")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("RESENT"));
    }

    @Test
    void batchResend_shouldReturn200_withCounts() throws Exception {
        BatchResendRequest request = BatchResendRequest.builder()
                .ids(List.of("dlq-1", "dlq-2"))
                .build();

        BatchResendResponse response = BatchResendResponse.builder()
                .successCount(1)
                .failedCount(1)
                .results(List.of(
                        Map.of("id", "dlq-1", "status", "RESENT"),
                        Map.of("id", "dlq-2", "status", "PENDING")
                ))
                .build();

        when(dlqMessageService.batchResend(anyList())).thenReturn(response);

        mockMvc.perform(post("/api/v1/msg/dlq/batch-resend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.successCount").value(1))
                .andExpect(jsonPath("$.data.failedCount").value(1));
    }
}
