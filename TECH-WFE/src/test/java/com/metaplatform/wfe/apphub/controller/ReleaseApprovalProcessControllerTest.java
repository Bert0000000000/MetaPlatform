package com.metaplatform.wfe.apphub.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.apphub.dto.ReleaseApprovalCompleteRequest;
import com.metaplatform.wfe.apphub.dto.ReleaseApprovalStartRequest;
import com.metaplatform.wfe.apphub.service.ReleaseApprovalProcessService;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ReleaseApprovalProcessController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.wfe.security.SecurityConfig.class,
                        com.metaplatform.wfe.security.JwtAuthenticationFilter.class,
                        com.metaplatform.wfe.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class ReleaseApprovalProcessControllerTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReleaseApprovalProcessService releaseApprovalProcessService;

    private ReleaseApprovalStartRequest buildStartRequest() {
        ReleaseApprovalStartRequest request = new ReleaseApprovalStartRequest();
        request.setAppId("app-1");
        request.setVersion("v1.0.0");
        request.setReleaseNotes("首次发布");
        request.setStrategy("GRAYSCALE");
        request.setGrayPercent(25);
        request.setTechLeadId("tech-lead");
        request.setOpsOwnerId("ops-owner");
        return request;
    }

    private ProcessInstanceResponse buildProcessInstanceResponse() {
        return ProcessInstanceResponse.builder()
                .id("pi-001")
                .processDefinitionId("pd-001")
                .processKey("releaseApprovalProcess")
                .businessKey("app-1:v1.0.0")
                .status("RUNNING")
                .startUserId("user-001")
                .createdAt(Instant.now())
                .build();
    }

    private TaskResponse buildTaskResponse(String taskId, String name, String assignee) {
        return TaskResponse.builder()
                .id(taskId)
                .name(name)
                .assignee(assignee)
                .processInstanceId("pi-001")
                .processDefinitionId("pd-001")
                .createTime(Instant.now())
                .status("ACTIVE")
                .build();
    }

    @Test
    void startReleaseApproval_returns_ok() throws Exception {
        when(releaseApprovalProcessService.start(any(ReleaseApprovalStartRequest.class), eq("app-1:v1.0.0")))
                .thenReturn(buildProcessInstanceResponse());

        mockMvc.perform(post("/api/v1/wfe/release-approval/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(buildStartRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("pi-001"))
                .andExpect(jsonPath("$.data.status").value("RUNNING"));
    }

    @Test
    void startReleaseApproval_returns_400_when_version_blank() throws Exception {
        ReleaseApprovalStartRequest request = buildStartRequest();
        request.setVersion("");

        mockMvc.perform(post("/api/v1/wfe/release-approval/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getTasks_returns_list() throws Exception {
        when(releaseApprovalProcessService.getTasks("pi-001"))
                .thenReturn(List.of(
                        buildTaskResponse("task-1", "技术负责人审批", "tech-lead"),
                        buildTaskResponse("task-2", "运维审批", "ops-owner")));

        mockMvc.perform(get("/api/v1/wfe/release-approval/pi-001/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("技术负责人审批"));
    }

    @Test
    void completeTask_approve_returns_ok() throws Exception {
        ReleaseApprovalCompleteRequest request = new ReleaseApprovalCompleteRequest();
        request.setApproved(true);
        request.setComment("同意发布");

        when(releaseApprovalProcessService.complete("pi-001", "task-1", request))
                .thenReturn(TaskActionResponse.builder()
                        .taskId("task-1")
                        .action("APPROVE")
                        .status("SUCCESS")
                        .message("审批操作执行成功")
                        .build());

        mockMvc.perform(post("/api/v1/wfe/release-approval/pi-001/tasks/task-1/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.action").value("APPROVE"))
                .andExpect(jsonPath("$.data.status").value("SUCCESS"));
    }

    @Test
    void completeTask_reject_returns_ok() throws Exception {
        ReleaseApprovalCompleteRequest request = new ReleaseApprovalCompleteRequest();
        request.setApproved(false);
        request.setComment("存在风险，驳回");

        when(releaseApprovalProcessService.complete("pi-001", "task-1", request))
                .thenReturn(TaskActionResponse.builder()
                        .taskId("task-1")
                        .action("REJECT")
                        .status("SUCCESS")
                        .message("审批操作执行成功")
                        .build());

        mockMvc.perform(post("/api/v1/wfe/release-approval/pi-001/tasks/task-1/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.action").value("REJECT"));
    }

    @Test
    void completeTask_returns_400_when_approved_null() throws Exception {
        ReleaseApprovalCompleteRequest request = new ReleaseApprovalCompleteRequest();
        request.setComment("未填写审批结果");

        mockMvc.perform(post("/api/v1/wfe/release-approval/pi-001/tasks/task-1/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
