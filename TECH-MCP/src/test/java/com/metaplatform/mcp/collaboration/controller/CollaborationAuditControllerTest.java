package com.metaplatform.mcp.collaboration.controller;

import com.metaplatform.mcp.collaboration.dto.CollaborationAuditResponse;
import com.metaplatform.mcp.collaboration.service.CollaborationAuditService;
import com.metaplatform.mcp.common.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CollaborationAuditController.class)
class CollaborationAuditControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CollaborationAuditService collaborationAuditService;

    private CollaborationAuditResponse sampleResponse() {
        return CollaborationAuditResponse.builder()
                .id(UUID.randomUUID())
                .callerId("caller-1")
                .callerType("AGENT")
                .calleeId("callee-1")
                .calleeType("AGENT")
                .operation("tools/list")
                .protocolType("MCP")
                .status("SUCCESS")
                .durationMs(120L)
                .traceId("trace-1")
                .calledAt(Instant.now())
                .build();
    }

    @Test
    void record_collaboration_returns_200() throws Exception {
        when(collaborationAuditService.record(any())).thenReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/mcp/collaborations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerId\":\"caller-1\",\"calleeId\":\"callee-1\",\"durationMs\":120}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.callerId").value("caller-1"));
    }

    @Test
    void list_collaborations_returns_page() throws Exception {
        when(collaborationAuditService.query(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(PageResponse.<CollaborationAuditResponse>builder()
                        .items(List.of(sampleResponse())).total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/collaborations/logs").param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void get_collaboration_by_id() throws Exception {
        UUID id = UUID.randomUUID();
        CollaborationAuditResponse response = sampleResponse();
        response.setId(id);
        when(collaborationAuditService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/mcp/collaborations/logs/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }
}
