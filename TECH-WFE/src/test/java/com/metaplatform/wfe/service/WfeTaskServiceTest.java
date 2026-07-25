package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.dto.TaskActionRequest;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
import com.metaplatform.wfe.engine.WfeStateMachineEngine;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.entity.WfeTaskHistoryEntity;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.WfeTaskCommentRepository;
import com.metaplatform.wfe.repository.WfeTaskHistoryRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WfeTaskServiceTest {

    @Mock
    private WfeTaskRepository wfeTaskRepository;

    @Mock
    private WfeTaskHistoryRepository wfeTaskHistoryRepository;

    @Mock
    private WfeTaskCommentRepository wfeTaskCommentRepository;

    @Mock
    private WfeStateMachineEngine wfeStateMachineEngine;

    @Mock
    private IamIntegrationService iamIntegrationService;

    @Mock
    private WfeOutboxService wfeOutboxService;

    @InjectMocks
    private WfeTaskService wfeTaskService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
        // P1-WFE-06: APPROVE 操作默认允许审批（userId 在测试上下文中可能为 null）
        when(iamIntegrationService.checkPermission(
                anyString(), nullable(String.class), anyString(), anyString()))
                .thenReturn(true);
    }

    // ════════════════════════════════════════════
    // P1-WFE-04: 任务查询测试
    // ════════════════════════════════════════════

    @Test
    void getTodoTasks_shouldReturnPage_whenUserHasTasks() {
        Instant now = Instant.now();
        WfeTaskEntity task1 = WfeTaskEntity.builder()
                .id("task-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processInstanceId("pi-001").processDefinitionId("pd-001")
                .nodeId("node-1").name("经理审批").assignee("user-001")
                .status("ACTIVE").createdAt(now)
                .build();
        WfeTaskEntity task2 = WfeTaskEntity.builder()
                .id("task-002").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processInstanceId("pi-002").processDefinitionId("pd-001")
                .nodeId("node-2").name("总监审批").assignee("user-001")
                .status("ACTIVE").createdAt(now)
                .build();

        PageImpl<WfeTaskEntity> page = new PageImpl<>(
                List.of(task1, task2), PageRequest.of(0, 20), 2);

        when(wfeTaskRepository.findByTenantIdAndAssigneeAndStatus(
                eq(TenantContext.DEFAULT_TENANT_ID), eq("user-001"),
                eq("ACTIVE"), any(PageRequest.class)))
                .thenReturn(page);

        PageResponse<TaskResponse> result = wfeTaskService.getTodoTasks("user-001", 1, 20);

        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.getPage()).isEqualTo(1);
        assertThat(result.getItems().get(0).getId()).isEqualTo("task-001");
        assertThat(result.getItems().get(0).getName()).isEqualTo("经理审批");
        assertThat(result.getItems().get(0).getAssignee()).isEqualTo("user-001");
        assertThat(result.getItems().get(0).getStatus()).isEqualTo("ACTIVE");
        assertThat(result.getItems().get(0).getEndTime()).isNull();
    }

    @Test
    void getDoneTasks_shouldReturnPage_whenUserHasFinishedTasks() {
        Instant now = Instant.now();
        WfeTaskHistoryEntity history = WfeTaskHistoryEntity.builder()
                .id("hist-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .taskId("task-001").processInstanceId("pi-001")
                .nodeId("node-1").name("经理审批").assignee("user-001")
                .action("APPROVE").operator("user-001")
                .comment("同意").createdAt(now)
                .build();

        PageImpl<WfeTaskHistoryEntity> page = new PageImpl<>(
                List.of(history), PageRequest.of(0, 20), 1);

        when(wfeTaskHistoryRepository.findByTenantIdAndAssigneeAndActionIn(
                eq(TenantContext.DEFAULT_TENANT_ID), eq("user-001"),
                any(List.class), any(PageRequest.class)))
                .thenReturn(page);

        PageResponse<TaskResponse> result = wfeTaskService.getDoneTasks("user-001", 1, 20);

        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getTotal()).isEqualTo(1);
        assertThat(result.getItems().get(0).getId()).isEqualTo("task-001");
        assertThat(result.getItems().get(0).getName()).isEqualTo("经理审批");
        assertThat(result.getItems().get(0).getAssignee()).isEqualTo("user-001");
        assertThat(result.getItems().get(0).getStatus()).isEqualTo("COMPLETED");
        assertThat(result.getItems().get(0).getEndTime()).isNotNull();
    }

    @Test
    void getTaskById_shouldReturnTask_whenExistsInTaskRepository() {
        Instant now = Instant.now();
        WfeTaskEntity task = WfeTaskEntity.builder()
                .id("task-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processInstanceId("pi-001").processDefinitionId("pd-001")
                .nodeId("node-1").name("经理审批").assignee("user-001")
                .status("ACTIVE").createdAt(now)
                .build();

        when(wfeTaskRepository.findById("task-001")).thenReturn(Optional.of(task));

        TaskResponse response = wfeTaskService.getTaskById("task-001");

        assertThat(response.getId()).isEqualTo("task-001");
        assertThat(response.getName()).isEqualTo("经理审批");
        assertThat(response.getAssignee()).isEqualTo("user-001");
        assertThat(response.getProcessInstanceId()).isEqualTo("pi-001");
        assertThat(response.getStatus()).isEqualTo("ACTIVE");
        assertThat(response.getEndTime()).isNull();

        // 当活动任务表中能查到时，不应访问历史表
        verify(wfeTaskHistoryRepository, never())
                .findByTenantIdAndTaskIdOrderByCreatedAtDesc(anyString(), anyString());
    }

    @Test
    void getTaskById_shouldReturnTask_whenFallbackToHistoryRepository() {
        Instant now = Instant.now();
        WfeTaskHistoryEntity history = WfeTaskHistoryEntity.builder()
                .id("hist-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .taskId("task-001").processInstanceId("pi-001")
                .nodeId("node-1").name("经理审批").assignee("user-001")
                .action("APPROVE").operator("user-001")
                .comment("同意").createdAt(now)
                .build();

        when(wfeTaskRepository.findById("task-001")).thenReturn(Optional.empty());
        when(wfeTaskHistoryRepository.findByTenantIdAndTaskIdOrderByCreatedAtDesc(
                TenantContext.DEFAULT_TENANT_ID, "task-001"))
                .thenReturn(List.of(history));

        TaskResponse response = wfeTaskService.getTaskById("task-001");

        assertThat(response.getId()).isEqualTo("task-001");
        assertThat(response.getName()).isEqualTo("经理审批");
        // 历史记录统一标记为 COMPLETED
        assertThat(response.getStatus()).isEqualTo("COMPLETED");
        assertThat(response.getEndTime()).isNotNull();
    }

    @Test
    void getTaskById_shouldThrow404_whenNotFound() {
        when(wfeTaskRepository.findById("nonexistent")).thenReturn(Optional.empty());
        when(wfeTaskHistoryRepository.findByTenantIdAndTaskIdOrderByCreatedAtDesc(
                TenantContext.DEFAULT_TENANT_ID, "nonexistent"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> wfeTaskService.getTaskById("nonexistent"))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("任务不存在");
    }

    @Test
    void getTasksByProcessInstance_shouldReturnAllTasks() {
        Instant now = Instant.now();
        WfeTaskEntity task1 = WfeTaskEntity.builder()
                .id("task-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processInstanceId("pi-001").processDefinitionId("pd-001")
                .nodeId("node-1").name("经理审批").assignee("user-001")
                .status("COMPLETED").createdAt(now).completedAt(now)
                .build();
        WfeTaskEntity task2 = WfeTaskEntity.builder()
                .id("task-002").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processInstanceId("pi-001").processDefinitionId("pd-001")
                .nodeId("node-2").name("总监审批").assignee("user-002")
                .status("ACTIVE").createdAt(now)
                .build();

        when(wfeTaskRepository.findByTenantIdAndProcessInstanceIdOrderByCreatedAtDesc(
                TenantContext.DEFAULT_TENANT_ID, "pi-001"))
                .thenReturn(List.of(task1, task2));

        List<TaskResponse> result = wfeTaskService.getTasksByProcessInstance("pi-001");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo("task-001");
        assertThat(result.get(0).getStatus()).isEqualTo("COMPLETED");
        assertThat(result.get(1).getId()).isEqualTo("task-002");
        assertThat(result.get(1).getStatus()).isEqualTo("ACTIVE");
    }

    // ════════════════════════════════════════════
    // P1-WFE-05: 审批操作测试
    // ════════════════════════════════════════════

    private WfeTaskEntity buildActiveTask() {
        return WfeTaskEntity.builder()
                .id("task-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processInstanceId("pi-001").processDefinitionId("pd-001")
                .nodeId("node-1").name("经理审批").assignee("user-001")
                .status("ACTIVE")
                .build();
    }

    @Test
    void executeAction_shouldApprove_whenActionIsApprove() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("APPROVE");
        request.setComment("同意");

        when(wfeTaskRepository.findByIdAndStatus("task-001", "ACTIVE"))
                .thenReturn(Optional.of(buildActiveTask()));

        TaskActionResponse response = wfeTaskService.executeAction("task-001", request);

        assertThat(response.getTaskId()).isEqualTo("task-001");
        assertThat(response.getAction()).isEqualTo("APPROVE");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        // 自研状态机引擎内部负责保存评论与历史，并推进流程
        verify(wfeStateMachineEngine).completeTask(
                eq("task-001"), eq("APPROVE"), nullable(String.class), eq("同意"), isNull());
    }

    @Test
    void executeAction_shouldReject_whenActionIsReject() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("REJECT");
        request.setComment("金额超限");

        when(wfeTaskRepository.findByIdAndStatus("task-001", "ACTIVE"))
                .thenReturn(Optional.of(buildActiveTask()));

        TaskActionResponse response = wfeTaskService.executeAction("task-001", request);

        assertThat(response.getAction()).isEqualTo("REJECT");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        verify(wfeStateMachineEngine).completeTask(
                eq("task-001"), eq("REJECT"), nullable(String.class), eq("金额超限"), isNull());
    }

    @Test
    void executeAction_shouldTransfer_whenActionIsTransfer() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("TRANSFER");
        request.setComment("请代为审批");
        request.setTransferTo("user-002");

        WfeTaskEntity task = buildActiveTask();
        when(wfeTaskRepository.findByIdAndStatus("task-001", "ACTIVE"))
                .thenReturn(Optional.of(task));

        TaskActionResponse response = wfeTaskService.executeAction("task-001", request);

        assertThat(response.getAction()).isEqualTo("TRANSFER");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        // 转交不推进流程，只更新 assignee
        verify(wfeTaskRepository).save(task);
        assertThat(task.getAssignee()).isEqualTo("user-002");
        // 状态机不应被调用（不推进流程）
        verify(wfeStateMachineEngine, never()).completeTask(
                anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void executeAction_shouldReturn_whenActionIsReturn() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("RETURN");
        request.setComment("信息不完整");

        when(wfeTaskRepository.findByIdAndStatus("task-001", "ACTIVE"))
                .thenReturn(Optional.of(buildActiveTask()));

        TaskActionResponse response = wfeTaskService.executeAction("task-001", request);

        assertThat(response.getAction()).isEqualTo("RETURN");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        // RETURN 通过 formData 携带 RETURN 标记推进流程
        verify(wfeStateMachineEngine).completeTask(
                eq("task-001"), eq("RETURN"), nullable(String.class),
                eq("信息不完整"), eq(Map.of("action", "RETURN")));
    }

    @Test
    void executeAction_shouldThrow400_whenTransferToIsMissing() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("TRANSFER");
        request.setComment("转交");

        assertThatThrownBy(() -> wfeTaskService.executeAction("task-001", request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("transferTo");

        // 参数校验失败前不应访问数据库
        verify(wfeTaskRepository, never()).findByIdAndStatus(anyString(), anyString());
        verify(wfeStateMachineEngine, never()).completeTask(
                anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void executeAction_shouldThrow404_whenTaskNotFound() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("APPROVE");
        request.setComment("同意");

        when(wfeTaskRepository.findByIdAndStatus("nonexistent", "ACTIVE"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> wfeTaskService.executeAction("nonexistent", request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("任务不存在");

        verify(wfeStateMachineEngine, never()).completeTask(
                anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void executeAction_shouldThrow400_whenActionIsInvalid() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("INVALID");
        request.setComment("无效操作");

        assertThatThrownBy(() -> wfeTaskService.executeAction("task-001", request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("无效的审批操作类型");
    }

    // ════════════════════════════════════════════
    // P1-WFE-06 / P1-WFE-09: 权限校验与事件发布
    // ════════════════════════════════════════════

    @Test
    void executeAction_shouldRejectPermission_whenNotApproved() {
        when(iamIntegrationService.checkPermission(
                anyString(), nullable(String.class), anyString(), anyString()))
                .thenReturn(false);

        TaskActionRequest request = new TaskActionRequest();
        request.setAction("APPROVE");
        request.setComment("同意");

        when(wfeTaskRepository.findByIdAndStatus("task-001", "ACTIVE"))
                .thenReturn(Optional.of(buildActiveTask()));

        assertThatThrownBy(() -> wfeTaskService.executeAction("task-001", request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("无审批权限");

        verify(wfeStateMachineEngine, never()).completeTask(
                anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void executeAction_shouldPublishTaskCompletedEvent_whenApproved() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("APPROVE");
        request.setComment("同意");

        when(wfeTaskRepository.findByIdAndStatus("task-001", "ACTIVE"))
                .thenReturn(Optional.of(buildActiveTask()));

        wfeTaskService.executeAction("task-001", request);

        verify(wfeOutboxService).publishEvent(
                anyString(), eq("task-001"), eq("TASK_COMPLETED"), any(), any());
    }

    @Test
    void executeAction_shouldPublishTaskRejectedEvent_whenRejected() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("REJECT");
        request.setComment("拒绝");

        when(wfeTaskRepository.findByIdAndStatus("task-001", "ACTIVE"))
                .thenReturn(Optional.of(buildActiveTask()));

        wfeTaskService.executeAction("task-001", request);

        verify(wfeOutboxService).publishEvent(
                anyString(), eq("task-001"), eq("TASK_REJECTED"), any(), any());
    }
}
