package com.metaplatform.msg.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.msg.dto.CleanupRequest;
import com.metaplatform.msg.dto.CleanupResponse;
import com.metaplatform.msg.dto.RetryPolicyRequest;
import com.metaplatform.msg.dto.RetryPolicyResponse;
import com.metaplatform.msg.service.DlqRetryPolicyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DlqRetryPolicyController.class)
@AutoConfigureMockMvc(addFilters = false)
class DlqRetryPolicyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DlqRetryPolicyService dlqRetryPolicyService;

    @Test
    void createOrUpdate_shouldReturn200_whenRequestIsValid() throws Exception {
        RetryPolicyRequest request = RetryPolicyRequest.builder()
                .tenantId("tenant-default")
                .topic("test-topic")
                .maxRetries(5)
                .retryIntervalSeconds(120)
                .retryBackoffMultiplier(3.0)
                .autoCleanupDays(60)
                .build();

        RetryPolicyResponse response = RetryPolicyResponse.builder()
                .id("policy-1")
                .tenantId("tenant-default")
                .topic("test-topic")
                .maxRetries(5)
                .retryIntervalSeconds(120)
                .retryBackoffMultiplier(3.0)
                .autoCleanupDays(60)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        when(dlqRetryPolicyService.createOrUpdate(any(), any(), any(), any(), any(), any())).thenReturn(response);

        mockMvc.perform(put("/api/v1/msg/dlq/policies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("policy-1"))
                .andExpect(jsonPath("$.data.topic").value("test-topic"))
                .andExpect(jsonPath("$.data.maxRetries").value(5));
    }

    @Test
    void list_shouldReturn200_withAllPolicies() throws Exception {
        RetryPolicyResponse policy = RetryPolicyResponse.builder()
                .id("policy-1")
                .tenantId("tenant-default")
                .topic("test-topic")
                .maxRetries(3)
                .build();

        when(dlqRetryPolicyService.list(any())).thenReturn(List.of(policy));

        mockMvc.perform(get("/api/v1/msg/dlq/policies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].id").value("policy-1"))
                .andExpect(jsonPath("$.data[0].topic").value("test-topic"));
    }

    @Test
    void getByTopic_shouldReturn200_whenPolicyExists() throws Exception {
        RetryPolicyResponse response = RetryPolicyResponse.builder()
                .id("policy-1")
                .topic("test-topic")
                .maxRetries(3)
                .build();

        when(dlqRetryPolicyService.getByTopic(any(), eq("test-topic"))).thenReturn(response);

        mockMvc.perform(get("/api/v1/msg/dlq/policies/test-topic"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("policy-1"))
                .andExpect(jsonPath("$.data.topic").value("test-topic"));
    }

    @Test
    void delete_shouldReturn200_whenPolicyDeleted() throws Exception {
        doNothing().when(dlqRetryPolicyService).delete("policy-1");

        mockMvc.perform(delete("/api/v1/msg/dlq/policies/policy-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void cleanup_shouldReturn200_withDeletedCount() throws Exception {
        CleanupRequest request = CleanupRequest.builder()
                .tenantId("tenant-default")
                .build();

        CleanupResponse response = CleanupResponse.builder()
                .tenantId("tenant-default")
                .deletedCount(5)
                .message("清理完成")
                .build();

        when(dlqRetryPolicyService.cleanupExpired(any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/msg/dlq/cleanup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.deletedCount").value(5));
    }
}
