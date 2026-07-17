package com.metaplatform.wfe.taskoperation.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.service.WfeOutboxService;
import com.metaplatform.wfe.taskoperation.dto.AddSignRequest;
import com.metaplatform.wfe.taskoperation.dto.DelegateRequest;
import com.metaplatform.wfe.taskoperation.dto.TaskOperationResponse;
import com.metaplatform.wfe.taskoperation.dto.UrgeRequest;
import com.metaplatform.wfe.taskoperation.entity.TaskAddSignEntity;
import com.metaplatform.wfe.taskoperation.entity.TaskDelegationEntity;
import com.metaplatform.wfe.taskoperation.entity.TaskUrgeEntity;
import com.metaplatform.wfe.taskoperation.repository.TaskAddSignRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskDelegationRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskUrgeRepository;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TaskOperationServiceTest {

    @Mock private TaskService taskService;
    @Mock private TaskDelegationRepository delegationRepository;
    @Mock private TaskAddSignRepository addSignRepository;
    @Mock private TaskUrgeRepository urgeRepository;
    @Mock private WfeOutboxService wfeOutboxService;

    @InjectMocks private TaskOperationService taskOperationService;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private Task mockActiveTask(String taskId, String assignee) {
        Task task = mock(Task.class);
        when(task.getId()).thenReturn(taskId);
        when(task.getAssignee()).thenReturn(assignee);
        when(task.getProcessInstanceId()).thenReturn("pi-001");
        TaskQuery query = mock(TaskQuery.class);
        when(taskService.createTaskQuery()).thenReturn(query);
        when(query.taskId(taskId)).thenReturn(query);
        when(query.singleResult()).thenReturn(task);
        return task;
    }

    @Test
    void addSign_persists_and_publishes_event() {
        mockActiveTask("task-001", "user-001");
        when(addSignRepository.save(any(TaskAddSignEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AddSignRequest request = new AddSignRequest();
        request.setAddsignUser("user-002");
        request.setReason("need co-approval");

        TaskOperationResponse response = taskOperationService.addSign("task-001", request);
        assertThat(response.getType()).isEqualTo("ADDSIGN");
        assertThat(response.getTargetUser()).isEqualTo("user-002");
        verify(addSignRepository).save(any(TaskAddSignEntity.class));
        verify(wfeOutboxService).publishEvent(anyString(), anyString(), eq("TASK_ADDSIGN"), any(), any());
    }

    @Test
    void delegate_persists_and_updates_assignee() {
        mockActiveTask("task-001", "user-001");
        when(delegationRepository.save(any(TaskDelegationEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        DelegateRequest request = new DelegateRequest();
        request.setToUser("user-002");
        request.setReason("out of office");

        TaskOperationResponse response = taskOperationService.delegate("task-001", request);
        assertThat(response.getType()).isEqualTo("DELEGATE");
        assertThat(response.getTargetUser()).isEqualTo("user-002");
        verify(taskService).setAssignee("task-001", "user-002");
        verify(wfeOutboxService).publishEvent(anyString(), anyString(), eq("TASK_DELEGATED"), any(), any());
    }

    @Test
    void urge_persists_and_publishes_event() {
        mockActiveTask("task-001", "user-001");
        when(urgeRepository.save(any(TaskUrgeEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UrgeRequest request = new UrgeRequest();
        request.setUrgedUser("user-002");
        request.setMessage("please handle ASAP");

        TaskOperationResponse response = taskOperationService.urge("task-001", request);
        assertThat(response.getType()).isEqualTo("URGE");
        assertThat(response.getTargetUser()).isEqualTo("user-002");
        verify(urgeRepository).save(any(TaskUrgeEntity.class));
        verify(wfeOutboxService).publishEvent(anyString(), anyString(), eq("TASK_URGED"), any(), any());
    }

    @Test
    void delegate_throws_404_when_task_not_found() {
        TaskQuery query = mock(TaskQuery.class);
        when(taskService.createTaskQuery()).thenReturn(query);
        when(query.taskId("missing")).thenReturn(query);
        when(query.singleResult()).thenReturn(null);

        DelegateRequest request = new DelegateRequest();
        request.setToUser("user-002");

        assertThatThrownBy(() -> taskOperationService.delegate("missing", request))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TASK_NOT_FOUND);
    }
}