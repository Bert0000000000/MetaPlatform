package com.metaplatform.iam.user.controller;

import com.metaplatform.iam.dto.user.BatchAssignResponse;
import com.metaplatform.iam.dto.user.BatchImportUsersResponse;
import com.metaplatform.iam.user.service.UserBatchService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = UserBatchController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.iam.security.SecurityConfig.class,
                           com.metaplatform.iam.security.JwtAuthenticationFilter.class,
                           com.metaplatform.iam.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class UserBatchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserBatchService userBatchService;

    @Test
    void batch_import_returns_response() throws Exception {
        when(userBatchService.batchImport(any())).thenReturn(BatchImportUsersResponse.builder()
                .totalCount(2).successCount(2).failedCount(0)
                .results(List.of()).build());

        mockMvc.perform(post("/api/v1/iam/users/batch/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"users\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalCount").value(2));
    }

    @Test
    void assign_role_returns_response() throws Exception {
        when(userBatchService.batchAssignRole(any())).thenReturn(BatchAssignResponse.builder()
                .totalCount(1).successCount(1).failedCount(0)
                .results(List.of()).build());

        mockMvc.perform(post("/api/v1/iam/users/batch/assign-role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userIds\":[\"u1\"],\"roleId\":\"r1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.successCount").value(1));
    }

    @Test
    void assign_position_returns_response() throws Exception {
        when(userBatchService.batchAssignPosition(any())).thenReturn(BatchAssignResponse.builder()
                .totalCount(1).successCount(1).failedCount(0)
                .results(List.of()).build());

        mockMvc.perform(post("/api/v1/iam/users/batch/assign-position")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userIds\":[\"u1\"],\"positionId\":\"p1\",\"departmentId\":\"d1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.successCount").value(1));
    }
}