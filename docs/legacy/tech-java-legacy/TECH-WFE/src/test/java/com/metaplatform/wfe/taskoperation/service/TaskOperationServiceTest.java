package com.metaplatform.wfe.taskoperation.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.WfeTaskCommentRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TaskOperationServiceTest {

    @Mock private WfeTaskRepository wfeTaskRepository;
    @Mock private WfeTaskCommentRepository wfeTaskCommentRepository;
    @Mock private TaskDelegationRepository delegationRepository;
    @Mock private TaskAddSignRepository addSignRepository;
    @Mock private TaskUrgeRepository urgeRepository;
    @Mock private WfeOutboxService wfeOutboxService;

    @InjectMocks private TaskOperationService taskOperationService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    /**
     * 构建一个 ACTIVE 状态的任务实体，用于 mock wfeTaskRepository.findByIdAndStatus 的返回。
     */
    private WfeTaskEntity mockActiveTask(String taskId, String assignee) {
        WfeTaskEntity task = WfeTaskEntity.builder()
                .id(taskId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processInstanceId("pi-001")
                .processDefinitionId("pd-001")
                .nodeId("node-1")
                .name("经理审批")
                .assignee(assignee)
                .status("ACTIVE")
                .build();
        when(wfeTaskRepository.findByIdAndStatus(taskId, "ACTIVE"))
                .thenReturn(Optional.of(task));
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
        assertThat(response.getOperator()).isEqualTo("user-001");
        assertThat(response.getReason()).isEqualTo("need co-approval");
        verify(addSignRepository).save(any(TaskAddSignEntity.class));
        // 转交/加签后任务 assignee 需更新（包含加签人）
        verify(wfeTaskRepository).save(any(WfeTaskEntity.class));
        verify(wfeOutboxService).publishEvent(
                anyString(), eq("task-001"), eq("TASK_ADDSIGN"), any(), any());
    }

    @Test
    void delegate_persists_and_updates_assignee() {
        WfeTaskEntity task = mockActiveTask("task-001", "user-001");
        when(delegationRepository.save(any(TaskDelegationEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        DelegateRequest request = new DelegateRequest();
        request.setToUser("user-002");
        request.setReason("out of office");

        TaskOperationResponse response = taskOperationService.delegate("task-001", request);

        assertThat(response.getType()).isEqualTo("DELEGATE");
        assertThat(response.getTargetUser()).isEqualTo("user-002");
        assertThat(response.getOperator()).isEqualTo("user-001");
        // 委派后任务 assignee 需更新为 toUser
        verify(wfeTaskRepository).save(task);
        assertThat(task.getAssignee()).isEqualTo("user-002");
        verify(delegationRepository).save(any(TaskDelegationEntity.class));
        verify(wfeOutboxService).publishEvent(
                anyString(), eq("task-001"), eq("TASK_DELEGATED"), any(), any());
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
        // userId 在测试上下文中为 null，urge 内部回退为 "system"
        assertThat(response.getOperator()).isEqualTo("system");
        verify(urgeRepository).save(any(TaskUrgeEntity.class));
        verify(wfeOutboxService).publishEvent(
                anyString(), eq("task-001"), eq("TASK_URGED"), any(), any());
    }

    @Test
    void delegate_throws_404_when_task_not_found() {
        when(wfeTaskRepository.findByIdAndStatus("missing", "ACTIVE"))
                .thenReturn(Optional.empty());

        DelegateRequest request = new DelegateRequest();
        request.setToUser("user-002");

        assertThatThrownBy(() -> taskOperationService.delegate("missing", request))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TASK_NOT_FOUND);

        verify(delegationRepository, never()).save(any(TaskDelegationEntity.class));
        verify(wfeOutboxService, never()).publishEvent(
                anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void addSign_throws_404_when_task_not_found() {
        when(wfeTaskRepository.findByIdAndStatus("missing", "ACTIVE"))
                .thenReturn(Optional.empty());

        AddSignRequest request = new AddSignRequest();
        request.setAddsignUser("user-002");

        assertThatThrownBy(() -> taskOperationService.addSign("missing", request))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TASK_NOT_FOUND);

        verify(addSignRepository, never()).save(any(TaskAddSignEntity.class));
    }

    @Test
    void urge_throws_404_when_task_not_found() {
        when(wfeTaskRepository.findByIdAndStatus("missing", "ACTIVE"))
                .thenReturn(Optional.empty());

        UrgeRequest request = new UrgeRequest();
        request.setUrgedUser("user-002");

        assertThatThrownBy(() -> taskOperationService.urge("missing", request))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TASK_NOT_FOUND);

        verify(urgeRepository, never()).save(any(TaskUrgeEntity.class));
    }
}
