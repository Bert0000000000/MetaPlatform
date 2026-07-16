package com.metaplatform.iam.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.role.AssignRolePermissionsRequest;
import com.metaplatform.iam.dto.role.AssignRolePermissionsResponse;
import com.metaplatform.iam.dto.role.CreateRoleRequest;
import com.metaplatform.iam.dto.role.RoleResponse;
import com.metaplatform.iam.entity.RoleEntity;
import com.metaplatform.iam.service.RoleService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = RoleController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.iam.security.SecurityConfig.class,
                           com.metaplatform.iam.security.JwtAuthenticationFilter.class,
                           com.metaplatform.iam.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class RoleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RoleService roleService;

    @Test
    void createRole_shouldReturn200() throws Exception {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setRoleCode("PM");
        request.setRoleName("项目经理");

        RoleResponse response = RoleResponse.builder()
                .roleId("r1").roleCode("PM").roleName("项目经理")
                .roleType(RoleEntity.RoleType.CUSTOM)
                .dataScope(RoleEntity.DataScope.SELF)
                .enabled(true).version(1).build();
        when(roleService.create(any(CreateRoleRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roleCode").value("PM"))
                .andExpect(jsonPath("$.data.roleType").value("CUSTOM"));
    }

    @Test
    void createRole_shouldReturn400_whenMissingRequired() throws Exception {
        // roleCode 缺失
        CreateRoleRequest request = new CreateRoleRequest();
        request.setRoleName("项目经理");

        mockMvc.perform(post("/api/v1/iam/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void assignPermissions_shouldReturn200() throws Exception {
        AssignRolePermissionsRequest request = new AssignRolePermissionsRequest();
        request.setPermissionIds(List.of("perm-1", "perm-2"));
        request.setReplaceMode(true);

        AssignRolePermissionsResponse response = AssignRolePermissionsResponse.builder()
                .roleId("r1").roleCode("PM").permissionCount(2)
                .assignedPermissions(List.of(
                        AssignRolePermissionsResponse.AssignedPermission.builder()
                                .permissionId("perm-1").permissionCode("user:read").build(),
                        AssignRolePermissionsResponse.AssignedPermission.builder()
                                .permissionId("perm-2").permissionCode("user:write").build()))
                .build();
        when(roleService.assignPermissions(any(String.class), any(AssignRolePermissionsRequest.class)))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/roles/r1/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roleId").value("r1"))
                .andExpect(jsonPath("$.data.permissionCount").value(2));
    }
}