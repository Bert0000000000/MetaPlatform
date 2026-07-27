package com.metaplatform.wfe.service;

import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.repository.WfeTaskHistoryRepository;
import com.metaplatform.wfe.repository.WfeTaskCommentRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import com.metaplatform.wfe.engine.WfeStateMachineEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;

/**
 * P5.3 WfeTaskService.createDirectApprovalTask - direct task creation
 * for TECH-AGENT Action Proposal approval routing.
 */
@DisplayName("P5.3 WfeTaskService.createDirectApprovalTask")
class DirectApprovalTaskTest {

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
    @DisplayName("createDirectApprovalTask: assigns manager and persists task")
    void createsTaskWithCorrectFields() {
        Map<String, Object> result = service.createDirectApprovalTask(
                "TENANT-01", "user-1001", "Approve 10% discount for CUST-10086",
                "PROP-1", "RequestDiscount", "HIGH");

        assertNotNull(result.get("taskId"));
        assertNotNull(result.get("processInstanceId"));
        assertEquals("ACTIVE", result.get("status"));
        assertEquals("manager@TENANT-01", result.get("assignee"));

        ArgumentCaptor<WfeTaskEntity> captor = ArgumentCaptor.forClass(WfeTaskEntity.class);
        Mockito.verify(taskRepo).save(captor.capture());
        WfeTaskEntity saved = captor.getValue();
        assertEquals("agent-action-approval", saved.getProcessDefinitionId());
        assertEquals("manager-approval", saved.getNodeId());
        assertNotNull(saved.getFormData());
        assertEquals("PROP-1", saved.getFormData().get("externalActionProposalId"));
        assertEquals("RequestDiscount", saved.getFormData().get("actionCode"));
        assertEquals("HIGH", saved.getFormData().get("riskLevel"));
        assertEquals("user-1001", saved.getFormData().get("requester"));
    }

    @Test
    @DisplayName("createDirectApprovalTask: missing fields get safe defaults")
    void safeDefaultsForMissingFields() {
        Map<String, Object> result = service.createDirectApprovalTask(
                null, null, null, null, null, null);

        assertNotNull(result.get("taskId"));
        ArgumentCaptor<WfeTaskEntity> captor = ArgumentCaptor.forClass(WfeTaskEntity.class);
        Mockito.verify(taskRepo).save(captor.capture());
        WfeTaskEntity saved = captor.getValue();
        assertEquals("tenant-default", saved.getTenantId());
        assertEquals("system", saved.getFormData().get("requester"));
        assertEquals("HIGH", saved.getFormData().get("riskLevel"));
    }
}
