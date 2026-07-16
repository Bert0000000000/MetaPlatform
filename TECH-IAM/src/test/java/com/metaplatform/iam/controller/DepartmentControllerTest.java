package com.metaplatform.iam.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.department.CreateDepartmentRequest;
import com.metaplatform.iam.dto.department.DepartmentResponse;
import com.metaplatform.iam.service.DepartmentService;
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

@WebMvcTest(controllers = DepartmentController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.iam.security.SecurityConfig.class,
                           com.metaplatform.iam.security.JwtAuthenticationFilter.class,
                           com.metaplatform.iam.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class DepartmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DepartmentService departmentService;

    @Test
    void createDepartment_shouldReturn200() throws Exception {
        CreateDepartmentRequest request = new CreateDepartmentRequest();
        request.setDeptCode("RD");
        request.setDeptName("研发部");

        DepartmentResponse response = DepartmentResponse.builder()
                .deptId("d1").deptCode("RD").deptName("研发部")
                .level(1).fullPath("/研发部").version(1)
                .build();
        when(departmentService.create(any(CreateDepartmentRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/departments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.deptId").value("d1"))
                .andExpect(jsonPath("$.data.deptCode").value("RD"));
    }

    @Test
    void listDepartments_shouldReturnPagedResult() throws Exception {
        PageResponse<DepartmentResponse> page = PageResponse.<DepartmentResponse>builder()
                .items(List.of(DepartmentResponse.builder()
                        .deptId("d1").deptCode("RD").deptName("研发部").level(1)
                        .fullPath("/研发部").build()))
                .total(1).page(1).size(20).totalPages(1).build();
        when(departmentService.list(eq(null), eq(null), eq(null), eq(null), eq(null))).thenReturn(page);

        mockMvc.perform(get("/api/v1/iam/departments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].deptCode").value("RD"));
    }

    @Test
    void createDepartment_shouldReturn400_whenMissingRequiredField() throws Exception {
        // deptCode 缺失
        CreateDepartmentRequest request = new CreateDepartmentRequest();
        request.setDeptName("研发部");

        mockMvc.perform(post("/api/v1/iam/departments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}