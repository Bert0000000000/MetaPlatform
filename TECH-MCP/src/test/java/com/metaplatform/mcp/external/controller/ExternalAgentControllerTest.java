package com.metaplatform.mcp.external.controller;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.external.dto.ExternalAgentResponse;
import com.metaplatform.mcp.external.dto.ExternalAgentTestResult;
import com.metaplatform.mcp.external.service.ExternalAgentService;
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

@WebMvcTest(ExternalAgentController.class)
class ExternalAgentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ExternalAgentService externalAgentService;

    private ExternalAgentResponse sampleResponse() {
        return ExternalAgentResponse.builder()
                .id(UUID.randomUUID())
                .name("external-agent")
                .endpoint("http://localhost:9001")
                .protocolType("MCP")
                .status("ACTIVE")
                .trustLevel("TRUSTED")
                .authType("none")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void create_external_agent_returns_200() throws Exception {
        when(externalAgentService.create(any())).thenReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/mcp/external-agents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"external-agent\",\"endpoint\":\"http://localhost:9001\",\"protocolType\":\"MCP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("external-agent"));
    }

    @Test
    void list_external_agents_returns_page() throws Exception {
        when(externalAgentService.list(any(), any(), any(), any(), any(), any()))
                .thenReturn(PageResponse.<ExternalAgentResponse>builder()
                        .items(List.of(sampleResponse())).total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/external-agents").param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void get_external_agent_by_id() throws Exception {
        UUID id = UUID.randomUUID();
        ExternalAgentResponse response = sampleResponse();
        response.setId(id);
        when(externalAgentService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/mcp/external-agents/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void update_external_agent_returns_200() throws Exception {
        UUID id = UUID.randomUUID();
        ExternalAgentResponse response = sampleResponse();
        response.setId(id);
        response.setTrustLevel("BLOCKED");
        when(externalAgentService.update(eq(id), any())).thenReturn(response);

        mockMvc.perform(put("/api/v1/mcp/external-agents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"trustLevel\":\"BLOCKED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.trustLevel").value("BLOCKED"));
    }

    @Test
    void delete_external_agent_returns_200() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/mcp/external-agents/{id}", id))
                .andExpect(status().isOk());
    }

    @Test
    void test_connection_returns_result() throws Exception {
        UUID id = UUID.randomUUID();
        when(externalAgentService.testConnection(id)).thenReturn(
                ExternalAgentTestResult.builder().success(true).responseTimeMs(120L).message("ok").protocolType("MCP").build());

        mockMvc.perform(post("/api/v1/mcp/external-agents/{id}/test-connection", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.success").value(true))
                .andExpect(jsonPath("$.data.responseTimeMs").value(120));
    }

    @Test
    void get_external_agent_not_found_returns_404() throws Exception {
        UUID id = UUID.randomUUID();
        when(externalAgentService.get(eq(id)))
                .thenThrow(new McpException(ErrorCode.EXTERNAL_AGENT_NOT_FOUND, "外部 Agent 不存在"));

        mockMvc.perform(get("/api/v1/mcp/external-agents/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.EXTERNAL_AGENT_NOT_FOUND.getCode()));
    }
}
