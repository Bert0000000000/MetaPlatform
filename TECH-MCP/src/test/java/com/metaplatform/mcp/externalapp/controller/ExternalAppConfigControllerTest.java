package com.metaplatform.mcp.externalapp.controller;

import com.metaplatform.mcp.IamTestConfig;
import org.springframework.context.annotation.Import;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.externalapp.dto.*;
import com.metaplatform.mcp.externalapp.service.McpAppConfigService;
import com.metaplatform.mcp.iam.filter.IamAuthFilter;
import com.metaplatform.mcp.stdio.McpStdioServerLauncher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Import(IamTestConfig.class)
@WebMvcTest(ExternalAppConfigController.class)
@AutoConfigureMockMvc(addFilters = false)
class ExternalAppConfigControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpAppConfigService appConfigService;

    @MockitoBean
    private IamAuthFilter iamAuthFilter;

    @MockitoBean
    private McpStdioServerLauncher mcpStdioServerLauncher;

    private String appId() {
        return UUID.randomUUID().toString();
    }

    private AppConfigResponse sampleConfig(String appId) {
        return AppConfigResponse.builder()
                .appId(appId)
                .rateLimitQps(100)
                .timeoutMs(30000)
                .allowedTools("[\"tool-1\"]")
                .deniedTools("[]")
                .webhookUrl("https://example.com/hook")
                .metadata("{}")
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
    }

    @Test
    void get_config_returns_200() throws Exception {
        String appId = appId();
        when(appConfigService.getConfig(appId)).thenReturn(sampleConfig(appId));
        mockMvc.perform(get("/api/v1/mcp/external-agents/{appId}/config", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.appId").value(appId))
                .andExpect(jsonPath("$.data.rateLimitQps").value(100));
    }

    @Test
    void get_config_app_not_found_returns_404() throws Exception {
        String appId = appId();
        when(appConfigService.getConfig(appId))
                .thenThrow(new McpException(ErrorCode.APP_NOT_FOUND, "外部应用不存在"));
        mockMvc.perform(get("/api/v1/mcp/external-agents/{appId}/config", appId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.APP_NOT_FOUND.getCode()));
    }

    @Test
    void put_config_upserts() throws Exception {
        String appId = appId();
        when(appConfigService.upsertConfig(eq(appId), any())).thenReturn(sampleConfig(appId));
        mockMvc.perform(put("/api/v1/mcp/external-agents/{appId}/config", appId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rateLimitQps\":100,\"timeoutMs\":30000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rateLimitQps").value(100));
    }

    @Test
    void list_api_keys_returns_list() throws Exception {
        String appId = appId();
        when(appConfigService.listApiKeys(appId)).thenReturn(List.of(
                AppApiKeyResponse.builder()
                        .keyId("mak_abc").appId(appId).name("key-1")
                        .status("ACTIVE").createdAt(OffsetDateTime.now()).build()));
        mockMvc.perform(get("/api/v1/mcp/external-agents/{appId}/api-keys", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].keyId").value("mak_abc"));
    }

    @Test
    void create_api_key_returns_plaintext() throws Exception {
        String appId = appId();
        when(appConfigService.createApiKey(eq(appId), any())).thenReturn(
                AppApiKeyCreatedResponse.builder()
                        .keyId("mak_abc")
                        .appId(appId)
                        .name("key-1")
                        .apiKey("mak_abc:secret123")
                        .status("ACTIVE")
                        .build());
        mockMvc.perform(post("/api/v1/mcp/external-agents/{appId}/api-keys", appId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"key-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.keyId").value("mak_abc"))
                .andExpect(jsonPath("$.data.apiKey").value("mak_abc:secret123"));
    }

    @Test
    void create_api_key_missing_name_returns_400() throws Exception {
        String appId = appId();
        mockMvc.perform(post("/api/v1/mcp/external-agents/{appId}/api-keys", appId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void delete_api_key_returns_200() throws Exception {
        String appId = appId();
        mockMvc.perform(delete("/api/v1/mcp/external-agents/{appId}/api-keys/{keyId}", appId, "mak_abc"))
                .andExpect(status().isOk());
        verify(appConfigService).deleteApiKey(appId, "mak_abc");
    }

    @Test
    void delete_api_key_with_revoke_flag_calls_revoke() throws Exception {
        String appId = appId();
        mockMvc.perform(delete("/api/v1/mcp/external-agents/{appId}/api-keys/{keyId}", appId, "mak_abc")
                        .param("revoke", "true"))
                .andExpect(status().isOk());
        verify(appConfigService).revokeApiKey(appId, "mak_abc");
        verify(appConfigService, never()).deleteApiKey(any(), any());
    }

    @Test
    void list_tool_grants_returns_toolIds() throws Exception {
        String appId = appId();
        when(appConfigService.listToolGrants(appId)).thenReturn(
                AppToolGrantResponse.builder().appId(appId).toolIds(List.of("tool-1", "tool-2")).build());
        mockMvc.perform(get("/api/v1/mcp/external-agents/{appId}/tools", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.toolIds[0]").value("tool-1"))
                .andExpect(jsonPath("$.data.toolIds[1]").value("tool-2"));
    }

    @Test
    void put_tool_grants_replaces() throws Exception {
        String appId = appId();
        when(appConfigService.replaceToolGrants(eq(appId), any())).thenReturn(
                AppToolGrantResponse.builder().appId(appId).toolIds(List.of("tool-a")).build());
        mockMvc.perform(put("/api/v1/mcp/external-agents/{appId}/tools", appId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toolIds\":[\"tool-a\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.toolIds[0]").value("tool-a"));
    }
}
