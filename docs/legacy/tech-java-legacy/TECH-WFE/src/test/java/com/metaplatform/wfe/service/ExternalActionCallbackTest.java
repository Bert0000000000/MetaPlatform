package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.WfeTaskCommentRepository;
import com.metaplatform.wfe.repository.WfeTaskHistoryRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import com.metaplatform.wfe.engine.WfeStateMachineEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;

/**
 * P5.4 WfeTaskService.approveExternalAction / rejectExternalAction.
 */
@DisplayName("P5.4 WfeTaskService external action callback")
class ExternalActionCallbackTest {

    private WfeTaskRepository taskRepo;
    private WfeTaskHistoryRepository histRepo;
    private WfeTaskCommentRepository commentRepo;
    private WfeStateMachineEngine engine;
    private WfeTaskService service;

    @BeforeEach
    void setUp() {
        taskRepo = Mockito.mock(WfeTaskRepository.class);
        histRepo = Mockito.mock(WfeTaskHistoryRepository.class);
        commentRepo = Mockito.mock(WfeTaskCommentRepository.class);
        engine = Mockito.mock(WfeStateMachineEngine.class);
        Mockito.when(taskRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new WfeTaskService(taskRepo, histRepo, commentRepo, engine, null, null);
    }

    @Test
    @DisplayName("approveExternalAction: reads proposalId from formData, marks COMPLETED")
    void approveExternalActionHappyPath() {
        WfeTaskEntity task = baseTask("task-1", Map.of(
                "externalActionProposalId", "PROP-99",
                "actionCode", "RequestDiscount",
                "riskLevel", "HIGH"));
        Mockito.when(taskRepo.findById("task-1")).thenReturn(Optional.of(task));

        Map<String, Object> result = service.approveExternalAction("task-1", "manager-1", "looks good");

        assertEquals("task-1", result.get("wfeTaskId"));
        assertEquals("PROP-99", result.get("externalActionProposalId"));
        assertEquals("COMPLETED", task.getStatus());
        assertEquals("APPROVE", task.getAction());
        assertNotNull(task.getCompletedAt());
    }

    @Test
    @DisplayName("approveExternalAction: missing formData -> throws 400")
    void approveExternalActionMissingFormData() {
        WfeTaskEntity task = baseTask("task-2", null);
        Mockito.when(taskRepo.findById("task-2")).thenReturn(Optional.of(task));

        WfeException ex = assertThrows(WfeException.class,
                () -> service.approveExternalAction("task-2", "manager-1", ""));
        assertEquals(ErrorCode.INVALID_PARAM, ex.getErrorCode());
    }

    @Test
    @DisplayName("approveExternalAction: missing task -> throws 404")
    void approveExternalActionMissingTask() {
        Mockito.when(taskRepo.findById("missing")).thenReturn(Optional.empty());
        WfeException ex = assertThrows(WfeException.class,
                () -> service.approveExternalAction("missing", "manager-1", ""));
        assertEquals(ErrorCode.TASK_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    @DisplayName("rejectExternalAction: marks COMPLETED with REJECT action")
    void rejectExternalActionHappyPath() {
        WfeTaskEntity task = baseTask("task-3", Map.of("externalActionProposalId", "PROP-77"));
        Mockito.when(taskRepo.findById("task-3")).thenReturn(Optional.of(task));

        Map<String, Object> result = service.rejectExternalAction("task-3", "manager-1", "out of scope");

        assertEquals("PROP-77", result.get("externalActionProposalId"));
        assertEquals("COMPLETED", task.getStatus());
        assertEquals("REJECT", task.getAction());
    }

    private WfeTaskEntity baseTask(String id, Map<String, Object> formData) {
        Instant now = Instant.now();
        return WfeTaskEntity.builder()
                .id(id)
                .tenantId("TENANT-01")
                .processInstanceId("PROC-1")
                .processDefinitionId("agent-action-approval")
                .nodeId("manager-approval")
                .nodeName("Approve agent action")
                .name("Approve agent action")
                .assignee("manager@TENANT-01")
                .status("ACTIVE")
                .action("PENDING")
                .formData(formData)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
