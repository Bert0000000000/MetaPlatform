package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.dto.TaskActionRequest;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
import com.metaplatform.wfe.exception.WfeException;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.flowable.task.api.history.HistoricTaskInstance;
import org.flowable.task.api.history.HistoricTaskInstanceQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WfeTaskServiceTest {

    @Mock
    private TaskService taskService;

    @Mock
    private HistoryService historyService;

    @Mock
    private RuntimeService runtimeService;

    @Mock
    private IamIntegrationService iamIntegrationService;

    @Mock
    private WfeOutboxService wfeOutboxService;

    @InjectMocks
    private WfeTaskService wfeTaskService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
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
        Date now = new Date();
        Task task1 = mock(Task.class);
        when(task1.getId()).thenReturn("task-001");
        when(task1.getName()).thenReturn("经理审批");
        when(task1.getAssignee()).thenReturn("user-001");
        when(task1.getProcessInstanceId()).thenReturn("pi-001");
        when(task1.getProcessDefinitionId()).thenReturn("pd-001");
        when(task1.getCreateTime()).thenReturn(now);

        Task task2 = mock(Task.class);
        when(task2.getId()).thenReturn("task-002");
        when(task2.getName()).thenReturn("总监审批");
        when(task2.getAssignee()).thenReturn("user-001");
        when(task2.getProcessInstanceId()).thenReturn("pi-002");
        when(task2.getProcessDefinitionId()).thenReturn("pd-001");
        when(task2.getCreateTime()).thenReturn(now);

        TaskQuery query = mock(TaskQuery.class);
        when(taskService.createTaskQuery()).thenReturn(query);
        when(query.taskAssignee("user-001")).thenReturn(query);
        when(query.active()).thenReturn(query);
        when(query.orderByTaskCreateTime()).thenReturn(query);
        when(query.desc()).thenReturn(query);
        when(query.count()).thenReturn(2L);
        when(query.listPage(0, 20)).thenReturn(List.of(task1, task2));

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
        Date now = new Date();
        HistoricTaskInstance histTask = mock(HistoricTaskInstance.class);
        when(histTask.getId()).thenReturn("task-001");
        when(histTask.getName()).thenReturn("经理审批");
        when(histTask.getAssignee()).thenReturn("user-001");
        when(histTask.getProcessInstanceId()).thenReturn("pi-001");
        when(histTask.getProcessDefinitionId()).thenReturn("pd-001");
        when(histTask.getCreateTime()).thenReturn(now);
        when(histTask.getEndTime()).thenReturn(now);

        HistoricTaskInstanceQuery query = mock(HistoricTaskInstanceQuery.class);
        when(historyService.createHistoricTaskInstanceQuery()).thenReturn(query);
        when(query.taskAssignee("user-001")).thenReturn(query);
        when(query.finished()).thenReturn(query);
        when(query.orderByHistoricTaskInstanceEndTime()).thenReturn(query);
        when(query.desc()).thenReturn(query);
        when(query.count()).thenReturn(1L);
        when(query.listPage(0, 20)).thenReturn(List.of(histTask));

        PageResponse<TaskResponse> result = wfeTaskService.getDoneTasks("user-001", 1, 20);

        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getTotal()).isEqualTo(1);
        assertThat(result.getItems().get(0).getId()).isEqualTo("task-001");
        assertThat(result.getItems().get(0).getStatus()).isEqualTo("COMPLETED");
        assertThat(result.getItems().get(0).getEndTime()).isNotNull();
    }

    @Test
    void getTaskById_shouldReturnTask_whenExists() {
        Date now = new Date();
        HistoricTaskInstance histTask = mock(HistoricTaskInstance.class);
        when(histTask.getId()).thenReturn("task-001");
        when(histTask.getName()).thenReturn("经理审批");
        when(histTask.getAssignee()).thenReturn("user-001");
        when(histTask.getProcessInstanceId()).thenReturn("pi-001");
        when(histTask.getProcessDefinitionId()).thenReturn("pd-001");
        when(histTask.getCreateTime()).thenReturn(now);
        when(histTask.getEndTime()).thenReturn(null);

        HistoricTaskInstanceQuery query = mock(HistoricTaskInstanceQuery.class);
        when(historyService.createHistoricTaskInstanceQuery()).thenReturn(query);
        when(query.taskId("task-001")).thenReturn(query);
        when(query.singleResult()).thenReturn(histTask);

        TaskResponse response = wfeTaskService.getTaskById("task-001");

        assertThat(response.getId()).isEqualTo("task-001");
        assertThat(response.getName()).isEqualTo("经理审批");
        assertThat(response.getAssignee()).isEqualTo("user-001");
        assertThat(response.getProcessInstanceId()).isEqualTo("pi-001");
        assertThat(response.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void getTaskById_shouldThrow404_whenNotFound() {
        HistoricTaskInstanceQuery query = mock(HistoricTaskInstanceQuery.class);
        when(historyService.createHistoricTaskInstanceQuery()).thenReturn(query);
        when(query.taskId("nonexistent")).thenReturn(query);
        when(query.singleResult()).thenReturn(null);

        assertThatThrownBy(() -> wfeTaskService.getTaskById("nonexistent"))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("任务不存在");
    }

    @Test
    void getTasksByProcessInstance_shouldReturnAllTasks() {
        Date now = new Date();
        HistoricTaskInstance task1 = mock(HistoricTaskInstance.class);
        when(task1.getId()).thenReturn("task-001");
        when(task1.getName()).thenReturn("经理审批");
        when(task1.getAssignee()).thenReturn("user-001");
        when(task1.getProcessInstanceId()).thenReturn("pi-001");
        when(task1.getProcessDefinitionId()).thenReturn("pd-001");
        when(task1.getCreateTime()).thenReturn(now);
        when(task1.getEndTime()).thenReturn(now);

        HistoricTaskInstance task2 = mock(HistoricTaskInstance.class);
        when(task2.getId()).thenReturn("task-002");
        when(task2.getName()).thenReturn("总监审批");
        when(task2.getAssignee()).thenReturn("user-002");
        when(task2.getProcessInstanceId()).thenReturn("pi-001");
        when(task2.getProcessDefinitionId()).thenReturn("pd-001");
        when(task2.getCreateTime()).thenReturn(now);
        when(task2.getEndTime()).thenReturn(null);

        HistoricTaskInstanceQuery query = mock(HistoricTaskInstanceQuery.class);
        when(historyService.createHistoricTaskInstanceQuery()).thenReturn(query);
        when(query.processInstanceId("pi-001")).thenReturn(query);
        when(query.orderByTaskCreateTime()).thenReturn(query);
        when(query.desc()).thenReturn(query);
        when(query.list()).thenReturn(List.of(task1, task2));

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

    private Task mockTask(String taskId, String processInstanceId) {
        Task task = mock(Task.class);
        when(task.getId()).thenReturn(taskId);
        when(task.getProcessInstanceId()).thenReturn(processInstanceId);

        TaskQuery query = mock(TaskQuery.class);
        when(taskService.createTaskQuery()).thenReturn(query);
        when(query.taskId(taskId)).thenReturn(query);
        when(query.singleResult()).thenReturn(task);
        return task;
    }

    @Test
    void executeAction_shouldApprove_whenActionIsApprove() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("APPROVE");
        request.setComment("同意");

        mockTask("task-001", "pi-001");

        TaskActionResponse response = wfeTaskService.executeAction("task-001", request);

        assertThat(response.getTaskId()).isEqualTo("task-001");
        assertThat(response.getAction()).isEqualTo("APPROVE");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        verify(taskService).addComment("task-001", "pi-001", "同意");
        verify(taskService).complete("task-001");
    }

    @Test
    void executeAction_shouldReject_whenActionIsReject() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("REJECT");
        request.setComment("金额超限");

        mockTask("task-001", "pi-001");

        TaskActionResponse response = wfeTaskService.executeAction("task-001", request);

        assertThat(response.getAction()).isEqualTo("REJECT");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        verify(taskService).addComment("task-001", "pi-001", "金额超限");
        verify(runtimeService).deleteProcessInstance("pi-001", "REJECTED: 金额超限");
    }

    @Test
    void executeAction_shouldTransfer_whenActionIsTransfer() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("TRANSFER");
        request.setComment("请代为审批");
        request.setTransferTo("user-002");

        mockTask("task-001", "pi-001");

        TaskActionResponse response = wfeTaskService.executeAction("task-001", request);

        assertThat(response.getAction()).isEqualTo("TRANSFER");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        verify(taskService).addComment("task-001", "pi-001", "请代为审批");
        verify(taskService).setAssignee("task-001", "user-002");
    }

    @Test
    void executeAction_shouldReturn_whenActionIsReturn() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("RETURN");
        request.setComment("信息不完整");

        mockTask("task-001", "pi-001");

        TaskActionResponse response = wfeTaskService.executeAction("task-001", request);

        assertThat(response.getAction()).isEqualTo("RETURN");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        verify(taskService).addComment("task-001", "pi-001", "信息不完整");
        verify(taskService).complete(eq("task-001"), any(Map.class));
    }

    @Test
    void executeAction_shouldThrow400_whenTransferToIsMissing() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("TRANSFER");
        request.setComment("转交");

        assertThatThrownBy(() -> wfeTaskService.executeAction("task-001", request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("transferTo");

        verify(taskService, never()).createTaskQuery();
    }

    @Test
    void executeAction_shouldThrow404_whenTaskNotFound() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("APPROVE");
        request.setComment("同意");

        TaskQuery query = mock(TaskQuery.class);
        when(taskService.createTaskQuery()).thenReturn(query);
        when(query.taskId("nonexistent")).thenReturn(query);
        when(query.singleResult()).thenReturn(null);

        assertThatThrownBy(() -> wfeTaskService.executeAction("nonexistent", request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("任务不存在");
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

        mockTask("task-001", "pi-001");

        assertThatThrownBy(() -> wfeTaskService.executeAction("task-001", request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("无审批权限");

        verify(taskService, never()).complete(anyString());
    }

    @Test
    void executeAction_shouldPublishTaskCompletedEvent_whenApproved() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("APPROVE");
        request.setComment("同意");

        mockTask("task-001", "pi-001");

        wfeTaskService.executeAction("task-001", request);

        verify(wfeOutboxService).publishEvent(
                anyString(), eq("task-001"), eq("TASK_COMPLETED"), any(), any());
    }

    @Test
    void executeAction_shouldPublishTaskRejectedEvent_whenRejected() {
        TaskActionRequest request = new TaskActionRequest();
        request.setAction("REJECT");
        request.setComment("拒绝");

        mockTask("task-001", "pi-001");

        wfeTaskService.executeAction("task-001", request);

        verify(wfeOutboxService).publishEvent(
                anyString(), eq("task-001"), eq("TASK_REJECTED"), any(), any());
    }
}
