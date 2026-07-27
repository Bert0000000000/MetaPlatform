package com.metaplatform.mcp.permission.controller;

import com.metaplatform.mcp.IamTestConfig;
import org.springframework.context.annotation.Import;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.iam.filter.IamAuthFilter;
import com.metaplatform.mcp.permission.dto.*;
import com.metaplatform.mcp.permission.service.McpPermissionService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Import(IamTestConfig.class)
@WebMvcTest(McpPermissionController.class)
@AutoConfigureMockMvc(addFilters = false)
class McpPermissionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpPermissionService permissionService;

    @MockitoBean
    private IamAuthFilter iamAuthFilter;

    @MockitoBean
    private McpStdioServerLauncher mcpStdioServerLauncher;

    private PermissionRuleResponse sampleRule() {
        return PermissionRuleResponse.builder()
                .id(1L)
                .ruleId("r-001")
                .name("allow-user1-execute")
                .subjectType("USER")
                .subjectId("user-1")
                .resourceType("TOOL")
                .resourceId("tool-1")
                .actions("execute,read")
                .effect("ALLOW")
                .priority(10)
                .enabled(true)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
    }

    @Test
    void create_rule_returns_200() throws Exception {
        when(permissionService.create(any())).thenReturn(sampleRule());

        mockMvc.perform(post("/api/v1/mcp/permissions/rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"allow-user1-execute\",\"subjectType\":\"USER\","
                                + "\"subjectId\":\"user-1\",\"resourceType\":\"TOOL\","
                                + "\"actions\":\"execute,read\",\"effect\":\"ALLOW\",\"priority\":10}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ruleId").value("r-001"))
                .andExpect(jsonPath("$.data.effect").value("ALLOW"));
    }

    @Test
    void create_rule_invalid_subject_type_returns_400() throws Exception {
        mockMvc.perform(post("/api/v1/mcp/permissions/rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"r\",\"subjectType\":\"INVALID\",\"subjectId\":\"u\","
                                + "\"resourceType\":\"TOOL\",\"actions\":\"execute\",\"effect\":\"ALLOW\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_rules_returns_page() throws Exception {
        when(permissionService.list(any(), any(), any(), any()))
                .thenReturn(PageResponse.<PermissionRuleResponse>builder()
                        .items(List.of(sampleRule())).total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/permissions/rules").param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void get_rule_by_id() throws Exception {
        when(permissionService.get("r-001")).thenReturn(sampleRule());
        mockMvc.perform(get("/api/v1/mcp/permissions/rules/{ruleId}", "r-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ruleId").value("r-001"));
    }

    @Test
    void get_rule_not_found_returns_404() throws Exception {
        when(permissionService.get("missing"))
                .thenThrow(new McpException(ErrorCode.PERMISSION_RULE_NOT_FOUND, "权限规则不存在"));
        mockMvc.perform(get("/api/v1/mcp/permissions/rules/{ruleId}", "missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.PERMISSION_RULE_NOT_FOUND.getCode()));
    }

    @Test
    void update_rule_returns_200() throws Exception {
        PermissionRuleResponse resp = sampleRule();
        when(permissionService.update(eq("r-001"), any())).thenReturn(resp);
        mockMvc.perform(put("/api/v1/mcp/permissions/rules/{ruleId}", "r-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"priority\":99}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ruleId").value("r-001"));
    }

    @Test
    void delete_rule_returns_200() throws Exception {
        mockMvc.perform(delete("/api/v1/mcp/permissions/rules/{ruleId}", "r-001"))
                .andExpect(status().isOk());
    }

    @Test
    void matrix_returns_structure() throws Exception {
        when(permissionService.matrix(any(), any())).thenReturn(
                PermissionMatrixResponse.builder()
                        .subjects(List.of(PermissionMatrixResponse.SubjectKey.builder()
                                .subjectType("USER").subjectId("user-1").build()))
                        .resources(List.of(PermissionMatrixResponse.ResourceKey.builder()
                                .resourceType("TOOL").resourceId("tool-1").build()))
                        .permissions(List.of(List.of(
                                PermissionMatrixResponse.MatrixCell.builder()
                                        .allowed(true).ruleIds(List.of("r-001")).build())))
                        .build());

        mockMvc.perform(get("/api/v1/mcp/permissions/matrix"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.subjects[0].subjectId").value("user-1"))
                .andExpect(jsonPath("$.data.permissions[0][0].allowed").value(true));
    }

    @Test
    void check_returns_allowed() throws Exception {
        when(permissionService.check(any())).thenReturn(
                PermissionCheckResponse.builder()
                        .allowed(true)
                        .decision("ALLOW")
                        .effect("ALLOW")
                        .matchedRules(List.of(PermissionCheckResponse.MatchedRule.builder()
                                .ruleId("r-001").name("allow").effect("ALLOW").priority(10).actions("execute").build()))
                        .reason("命中优先级 10 的 ALLOW 规则，允许")
                        .build());

        mockMvc.perform(post("/api/v1/mcp/permissions/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subjectId\":\"user-1\",\"resourceType\":\"TOOL\","
                                + "\"resourceId\":\"tool-1\",\"action\":\"execute\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.allowed").value(true))
                .andExpect(jsonPath("$.data.effect").value("ALLOW"));
    }

    @Test
    void check_missing_subject_id_returns_400() throws Exception {
        mockMvc.perform(post("/api/v1/mcp/permissions/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resourceType\":\"TOOL\",\"action\":\"execute\"}"))
                .andExpect(status().isBadRequest());
    }
}
