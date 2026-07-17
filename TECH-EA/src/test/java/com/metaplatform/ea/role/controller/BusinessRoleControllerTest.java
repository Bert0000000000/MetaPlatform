package com.metaplatform.ea.role.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.common.TraceFilter;
import com.metaplatform.ea.role.dto.CreateRoleRequest;
import com.metaplatform.ea.role.dto.RoleResponse;
import com.metaplatform.ea.role.dto.UpdateRoleRequest;
import com.metaplatform.ea.role.service.BusinessRoleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = BusinessRoleController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class BusinessRoleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private BusinessRoleService roleService;

    @Test
    void create_shouldReturn200() throws Exception {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setName("销售经理");
        request.setCode("SALES_MANAGER");

        RoleResponse response = RoleResponse.builder()
                .id(UUID.randomUUID())
                .code("SALES_MANAGER")
                .name("销售经理")
                .build();
        when(roleService.create(any(CreateRoleRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/ea/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("SALES_MANAGER"));
    }

    @Test
    void create_shouldReturn400_whenMissingRequiredField() throws Exception {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setName("销售经理");

        mockMvc.perform(post("/api/v1/ea/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void list_shouldReturnPagedResult() throws Exception {
        PageResponse<RoleResponse> page = PageResponse.<RoleResponse>builder()
                .items(List.of(RoleResponse.builder()
                        .id(UUID.randomUUID())
                        .code("SALES_MANAGER")
                        .name("销售经理")
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build()))
                .total(1).page(1).size(20).totalPages(1).build();
        when(roleService.list(eq(null), eq(null), eq(null))).thenReturn(page);

        mockMvc.perform(get("/api/v1/ea/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].code").value("SALES_MANAGER"));
    }

    @Test
    void get_shouldReturnRole() throws Exception {
        UUID id = UUID.randomUUID();
        RoleResponse response = RoleResponse.builder()
                .id(id)
                .code("SALES_MANAGER")
                .name("销售经理")
                .build();
        when(roleService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/ea/roles/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("SALES_MANAGER"));
    }

    @Test
    void update_shouldReturn200() throws Exception {
        UUID id = UUID.randomUUID();
        UpdateRoleRequest request = new UpdateRoleRequest();
        request.setName("高级销售经理");

        RoleResponse response = RoleResponse.builder()
                .id(id)
                .name("高级销售经理")
                .build();
        when(roleService.update(eq(id), any(UpdateRoleRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/v1/ea/roles/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("高级销售经理"));
    }

    @Test
    void delete_shouldReturn200() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/ea/roles/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }
}
