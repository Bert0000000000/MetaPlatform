package com.metaplatform.mcp.trust.controller;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.trust.dto.TrustResponse;
import com.metaplatform.mcp.trust.service.AgentTrustService;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AgentTrustController.class)
class AgentTrustControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AgentTrustService agentTrustService;

    private TrustResponse sampleResponse() {
        return TrustResponse.builder()
                .id(UUID.randomUUID())
                .agentId(UUID.randomUUID())
                .agentName("agent")
                .trustLevel("TRUSTED")
                .reason("approved")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void create_trust_returns_200() throws Exception {
        when(agentTrustService.create(any())).thenReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/mcp/trusts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"agentId\":\"" + UUID.randomUUID() + "\",\"trustLevel\":\"TRUSTED\",\"reason\":\"approved\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.trustLevel").value("TRUSTED"));
    }

    @Test
    void list_trusts_returns_page() throws Exception {
        when(agentTrustService.list(any(), any(), any(), any(), any()))
                .thenReturn(PageResponse.<TrustResponse>builder()
                        .items(List.of(sampleResponse())).total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/trusts").param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void get_trust_by_id() throws Exception {
        UUID id = UUID.randomUUID();
        TrustResponse response = sampleResponse();
        response.setId(id);
        when(agentTrustService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/mcp/trusts/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void update_trust_returns_200() throws Exception {
        UUID id = UUID.randomUUID();
        TrustResponse response = sampleResponse();
        response.setId(id);
        response.setTrustLevel("BLOCKED");
        when(agentTrustService.update(eq(id), any())).thenReturn(response);

        mockMvc.perform(put("/api/v1/mcp/trusts/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"trustLevel\":\"BLOCKED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.trustLevel").value("BLOCKED"));
    }

    @Test
    void delete_trust_returns_200() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/mcp/trusts/{id}", id))
                .andExpect(status().isOk());
    }

    @Test
    void get_trust_not_found_returns_404() throws Exception {
        UUID id = UUID.randomUUID();
        when(agentTrustService.get(eq(id)))
                .thenThrow(new McpException(ErrorCode.AGENT_TRUST_NOT_FOUND, "信任关系不存在"));

        mockMvc.perform(get("/api/v1/mcp/trusts/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.AGENT_TRUST_NOT_FOUND.getCode()));
    }
}
