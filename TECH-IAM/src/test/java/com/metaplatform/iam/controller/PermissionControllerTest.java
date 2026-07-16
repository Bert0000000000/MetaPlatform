package com.metaplatform.iam.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.permission.CreatePermissionRequest;
import com.metaplatform.iam.dto.permission.PermissionCheckRequest;
import com.metaplatform.iam.dto.permission.PermissionCheckResponse;
import com.metaplatform.iam.dto.permission.PermissionResponse;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.service.PermissionCheckService;
import com.metaplatform.iam.service.PermissionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = PermissionController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.iam.security.SecurityConfig.class,
                           com.metaplatform.iam.security.JwtAuthenticationFilter.class,
                           com.metaplatform.iam.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class PermissionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PermissionService permissionService;

    @MockBean
    private PermissionCheckService permissionCheckService;

    @Test
    void createPermission_shouldReturn200() throws Exception {
        CreatePermissionRequest request = new CreatePermissionRequest();
        request.setPermissionCode("user:read");
        request.setPermissionName("查看用户");
        request.setResourceType("USER");
        request.setActions(List.of("READ"));

        PermissionResponse response = PermissionResponse.builder()
                .permissionId("p1").permissionCode("user:read").permissionName("查看用户")
                .resourceType("USER").actions(List.of("READ"))
                .effect(PermissionEntity.Effect.ALLOW).version(1).build();
        when(permissionService.create(any(CreatePermissionRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permissionCode").value("user:read"))
                .andExpect(jsonPath("$.data.effect").value("ALLOW"));
    }

    @Test
    void createPermission_shouldReturn400_whenMissingRequired() throws Exception {
        // 缺少 actions
        CreatePermissionRequest request = new CreatePermissionRequest();
        request.setPermissionCode("user:read");
        request.setPermissionName("查看用户");
        request.setResourceType("USER");

        mockMvc.perform(post("/api/v1/iam/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listPermissions_shouldReturnPaged() throws Exception {
        PageResponse<PermissionResponse> page = PageResponse.<PermissionResponse>builder()
                .items(List.of(PermissionResponse.builder()
                        .permissionId("p1").permissionCode("user:read")
                        .permissionName("查看用户").resourceType("USER")
                        .actions(List.of("READ")).effect(PermissionEntity.Effect.ALLOW).build()))
                .total(1).page(1).size(20).totalPages(1).build();
        when(permissionService.list(any(), any(), any(), any(), any())).thenReturn(page);

        mockMvc.perform(get("/api/v1/iam/permissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].permissionCode").value("user:read"));
    }

    @Test
    void checkPermission_shouldReturnAllowed() throws Exception {
        PermissionCheckRequest request = new PermissionCheckRequest();
        request.setUserId("user-001");
        request.setResource("concept:PERSON");
        request.setAction("CREATE");

        PermissionCheckResponse response = PermissionCheckResponse.builder()
                .allowed(true)
                .reason("Role ADMIN has CREATE permission on concept:PERSON")
                .matchedPermissions(List.of("perm-001"))
                .build();
        when(permissionCheckService.check(any(PermissionCheckRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/permissions/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.allowed").value(true))
                .andExpect(jsonPath("$.data.matchedPermissions[0]").value("perm-001"));
    }
}