package com.metaplatform.mcp.jsonrpc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.prompt.repository.McpPromptTemplateRepository;
import com.metaplatform.mcp.prompt.service.PromptTemplateService;
import com.metaplatform.mcp.resource.repository.McpResourceRepository;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.dto.ToolExecutionResponse;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import com.metaplatform.mcp.tool.service.McpToolService;
import com.metaplatform.mcp.tool.service.ToolExecutionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class JsonRpcControllerTest {

    private MockMvc mockMvc;
    private McpToolService mcpToolService;
    private ToolExecutionService toolExecutionService;
    private McpToolRepository mcpToolRepository;
    private McpResourceRepository mcpResourceRepository;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        mcpToolService = mock(McpToolService.class);
        toolExecutionService = mock(ToolExecutionService.class);
        mcpToolRepository = mock(McpToolRepository.class);
        mcpResourceRepository = mock(McpResourceRepository.class);

        McpProtocolService protocolService = new McpProtocolService(
                mcpToolService,
                toolExecutionService,
                mock(PromptTemplateService.class),
                new ObjectMapper(),
                mcpToolRepository,
                mcpResourceRepository,
                mock(McpPromptTemplateRepository.class));
        protocolService.registerHandlers();

        mockMvc = MockMvcBuilders.standaloneSetup(
                new JsonRpcController(protocolService, mock(McpServerRepository.class)))
                .build();
    }

    @Test
    void initialize_returns_protocol_info() throws Exception {
        mockMvc.perform(post("/api/v1/mcp/jsonrpc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jsonrpc").value("2.0"))
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.result.protocolVersion").value(McpProtocolService.PROTOCOL_VERSION))
                .andExpect(jsonPath("$.result.serverInfo.name").value(McpProtocolService.SERVER_NAME));
    }

    @Test
    void tools_list_returns_enabled_tools() throws Exception {
        McpToolEntity tool = McpToolEntity.builder()
                .id(UUID.randomUUID()).name("My Tool").code("my_tool")
                .description("a tool").inputSchema("{\"type\":\"object\"}")
                .toolType("HTTP").enabled(true).build();
        when(mcpToolRepository.search(
                TenantContext.DEFAULT_TENANT_ID, null, null, Boolean.TRUE, null, null))
                .thenReturn(List.of(tool));

        mockMvc.perform(post("/api/v1/mcp/jsonrpc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\",\"params\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.tools[0].name").value("my_tool"))
                .andExpect(jsonPath("$.result.tools[0].title").value("My Tool"))
                .andExpect(jsonPath("$.result.tools[0].inputSchema.type").value("object"));
    }

    @Test
    void tools_call_success_returns_content() throws Exception {
        UUID toolId = UUID.randomUUID();
        McpToolEntity tool = McpToolEntity.builder()
                .id(toolId).name("My Tool").code("my_tool").toolType("HTTP").enabled(true).build();
        when(mcpToolService.findByCode("my_tool")).thenReturn(tool);
        when(toolExecutionService.executeTool(eq(toolId), any()))
                .thenReturn(ToolExecutionResponse.builder()
                        .id(UUID.randomUUID()).toolId(toolId).status("SUCCESS").output("result-data")
                        .traceId("t").build());

        mockMvc.perform(post("/api/v1/mcp/jsonrpc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"my_tool\",\"arguments\":{\"q\":1}}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.content[0].type").value("text"))
                .andExpect(jsonPath("$.result.content[0].text").value("result-data"))
                .andExpect(jsonPath("$.result.isError").value(false));
    }

    @Test
    void tools_call_failure_returns_is_error() throws Exception {
        UUID toolId = UUID.randomUUID();
        McpToolEntity tool = McpToolEntity.builder()
                .id(toolId).name("Fail Tool").code("fail_tool").toolType("HTTP").enabled(true).build();
        when(mcpToolService.findByCode("fail_tool")).thenReturn(tool);
        when(toolExecutionService.executeTool(eq(toolId), any()))
                .thenReturn(ToolExecutionResponse.builder()
                        .id(UUID.randomUUID()).toolId(toolId).status("FAILED").errorMessage("boom")
                        .traceId("t").build());

        mockMvc.perform(post("/api/v1/mcp/jsonrpc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"fail_tool\",\"arguments\":{}}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(true))
                .andExpect(jsonPath("$.result.content[0].text").value("boom"));
    }

    @Test
    void resources_list_returns_empty() throws Exception {
        when(mcpResourceRepository.search(TenantContext.DEFAULT_TENANT_ID, null, null))
                .thenReturn(List.of());

        mockMvc.perform(post("/api/v1/mcp/jsonrpc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"resources/list\",\"params\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.resources").isArray());
    }

    @Test
    void invalid_method_returns_method_not_found() throws Exception {
        mockMvc.perform(post("/api/v1/mcp/jsonrpc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"unknown/method\",\"params\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(McpProtocolService.CODE_METHOD_NOT_FOUND))
                .andExpect(jsonPath("$.error.message").exists());
    }

    @Test
    void tools_call_missing_name_returns_invalid_params() throws Exception {
        mockMvc.perform(post("/api/v1/mcp/jsonrpc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\",\"params\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(McpProtocolService.CODE_INVALID_PARAMS));
    }
}
