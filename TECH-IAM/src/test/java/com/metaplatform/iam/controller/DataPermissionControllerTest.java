package com.metaplatform.iam.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.dto.datapermission.CreateDataPermissionRequest;
import com.metaplatform.iam.dto.datapermission.DataPermissionResponse;
import com.metaplatform.iam.dto.datapermission.DataScopeResolveResponse;
import com.metaplatform.iam.entity.DataPermissionEntity;
import com.metaplatform.iam.service.DataPermissionService;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = DataPermissionController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.iam.security.SecurityConfig.class,
                           com.metaplatform.iam.security.JwtAuthenticationFilter.class,
                           com.metaplatform.iam.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class DataPermissionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DataPermissionService dataPermissionService;

    @Test
    void create_shouldReturn200() throws Exception {
        CreateDataPermissionRequest request = new CreateDataPermissionRequest();
        request.setRoleId("role-001");
        request.setResourceType("concept");
        request.setDataScope(DataPermissionEntity.DataScope.DEPT);

        DataPermissionResponse response = DataPermissionResponse.builder()
                .dataPermissionId("dp-001")
                .roleId("role-001")
                .resourceType("concept")
                .dataScope(DataPermissionEntity.DataScope.DEPT)
                .effect(DataPermissionEntity.Effect.ALLOW)
                .version(1)
                .build();
        when(dataPermissionService.create(any(CreateDataPermissionRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/data-permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dataPermissionId").value("dp-001"))
                .andExpect(jsonPath("$.data.dataScope").value("DEPT"));
    }

    @Test
    void list_shouldReturnItems() throws Exception {
        DataPermissionResponse item = DataPermissionResponse.builder()
                .dataPermissionId("dp-001").roleId("role-001")
                .resourceType("concept").dataScope(DataPermissionEntity.DataScope.ALL)
                .effect(DataPermissionEntity.Effect.ALLOW).build();
        when(dataPermissionService.list(any(), any(), any())).thenReturn(List.of(item));

        mockMvc.perform(get("/api/v1/iam/data-permissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].dataPermissionId").value("dp-001"));
    }

    @Test
    void resolve_shouldReturnDataScope() throws Exception {
        DataScopeResolveResponse response = DataScopeResolveResponse.builder()
                .userId("user-001")
                .resourceType("concept")
                .dataScope(DataPermissionEntity.DataScope.DEPT)
                .rowFilter("dept_id IN ('dept-A')")
                .columnFilter(List.of("salary"))
                .build();
        when(dataPermissionService.resolve(eq("user-001"), any(), eq("concept"))).thenReturn(response);

        mockMvc.perform(get("/api/v1/iam/data-permissions/resolve")
                        .param("userId", "user-001")
                        .param("resourceType", "concept")
                        .param("roleIds", "role-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dataScope").value("DEPT"))
                .andExpect(jsonPath("$.data.rowFilter").value("dept_id IN ('dept-A')"));
    }
}
