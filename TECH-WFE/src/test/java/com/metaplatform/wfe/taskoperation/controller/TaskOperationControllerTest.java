package com.metaplatform.wfe.taskoperation.controller;

import com.metaplatform.wfe.taskoperation.dto.TaskHistoryEntry;
import com.metaplatform.wfe.taskoperation.dto.TaskMonitoringStatistics;
import com.metaplatform.wfe.taskoperation.dto.TaskOperationResponse;
import com.metaplatform.wfe.taskoperation.service.TaskHistoryService;
import com.metaplatform.wfe.taskoperation.service.TaskMonitoringService;
import com.metaplatform.wfe.taskoperation.service.TaskOperationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = TaskOperationController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.wfe.security.SecurityConfig.class,
                           com.metaplatform.wfe.security.JwtAuthenticationFilter.class,
                           com.metaplatform.wfe.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class TaskOperationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TaskOperationService taskOperationService;
    @MockitoBean
    private TaskHistoryService taskHistoryService;
    @MockitoBean
    private TaskMonitoringService taskMonitoringService;

    @Test
    void addsign_returns_200() throws Exception {
        when(taskOperationService.addSign(eq("task-001"), any()))
                .thenReturn(TaskOperationResponse.builder()
                        .id("op-1").taskId("task-001").type("ADDSIGN")
                        .targetUser("user-002").createdAt(Instant.now()).build());

        mockMvc.perform(post("/api/v1/wfe/tasks/{id}/addsign", "task-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addsignUser\":\"user-002\",\"reason\":\"need co-approval\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("ADDSIGN"))
                .andExpect(jsonPath("$.data.targetUser").value("user-002"));
    }

    @Test
    void delegate_returns_200() throws Exception {
        when(taskOperationService.delegate(eq("task-001"), any()))
                .thenReturn(TaskOperationResponse.builder()
                        .id("op-2").taskId("task-001").type("DELEGATE")
                        .targetUser("user-002").build());

        mockMvc.perform(post("/api/v1/wfe/tasks/{id}/delegate", "task-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toUser\":\"user-002\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("DELEGATE"));
    }

    @Test
    void urge_returns_200() throws Exception {
        when(taskOperationService.urge(eq("task-001"), any()))
                .thenReturn(TaskOperationResponse.builder()
                        .id("op-3").taskId("task-001").type("URGE")
                        .targetUser("user-002").build());

        mockMvc.perform(post("/api/v1/wfe/tasks/{id}/urge", "task-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"urgedUser\":\"user-002\",\"message\":\"ASAP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("URGE"));
    }

    @Test
    void history_returns_entries() throws Exception {
        when(taskHistoryService.getHistory("task-001")).thenReturn(List.of(
                TaskHistoryEntry.builder().type("DELEGATE").timestamp(Instant.now()).build(),
                TaskHistoryEntry.builder().type("URGE").timestamp(Instant.now()).build()
        ));

        mockMvc.perform(get("/api/v1/wfe/tasks/{id}/history", "task-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void monitoring_statistics_returns_summary() throws Exception {
        when(taskMonitoringService.statistics())
                .thenReturn(TaskMonitoringStatistics.builder()
                        .totalActive(5).totalCompleted(20).totalOverdue(1)
                        .avgProcessingMinutes(15.5).delegations(3).addSigns(2).urges(4).build());

        mockMvc.perform(get("/api/v1/wfe/tasks/monitoring/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalActive").value(5))
                .andExpect(jsonPath("$.data.delegations").value(3));
    }

    @Test
    void addsign_validation_error_when_user_missing() throws Exception {
        mockMvc.perform(post("/api/v1/wfe/tasks/{id}/addsign", "task-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addsignUser\":\"\"}"))
                .andExpect(status().isBadRequest());
    }
}