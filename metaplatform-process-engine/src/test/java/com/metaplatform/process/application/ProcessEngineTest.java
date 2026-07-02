package com.metaplatform.process.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.ProcessTask;
import com.metaplatform.process.domain.dsl.*;
import com.metaplatform.process.domain.enums.*;
import com.metaplatform.process.domain.repository.*;
import com.metaplatform.process.infrastructure.exception.ProcessEngineException;
import com.metaplatform.process.infrastructure.util.JsonUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProcessEngineTest {

    @Mock
    private ProcessInstanceRepository instanceRepository;
    @Mock
    private ProcessDefinitionRepository definitionRepository;
    @Mock
    private ProcessTaskRepository taskRepository;
    @Mock
    private ProcessHistoryRepository historyRepository;

    private ProcessEngine engine;
    private DslParser dslParser;
    private DefinitionValidator validator;
    private ParticipantResolver participantResolver;
    private SlaTracker slaTracker;

    private String approvalDslJson;

    @BeforeEach
    void setUp() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        dslParser = new DslParser(mapper);
        validator = new DefinitionValidator();
        participantResolver = new ParticipantResolver();
        slaTracker = mock(SlaTracker.class);

        engine = new ProcessEngine(instanceRepository, definitionRepository,
            taskRepository, historyRepository, dslParser, validator, participantResolver, slaTracker);

        approvalDslJson = """
            {
              "key": "test_approval",
              "name": "Test Approval",
              "variables": [
                {"name": "amount", "type": "DECIMAL", "required": true}
              ],
              "nodes": [
                {"id": "start", "type": "START", "name": "Start"},
                {"id": "check", "type": "GATEWAY", "name": "Amount Check", "gatewayType": "XOR"},
                {"id": "auto_approve", "type": "END", "name": "Auto Approve",
                 "action": {"type": "SET_VARIABLE", "variable": "status", "value": "APPROVED"}},
                {"id": "manual_approve", "type": "TASK", "name": "Manual Approval",
                 "assignee": {"type": "USER", "value": "manager01"},
                 "taskType": "APPROVAL"},
                {"id": "end_approved", "type": "END", "name": "Approved",
                 "action": {"type": "SET_VARIABLE", "variable": "status", "value": "APPROVED"}},
                {"id": "end_rejected", "type": "END", "name": "Rejected",
                 "action": {"type": "SET_VARIABLE", "variable": "status", "value": "REJECTED"}}
              ],
              "transitions": [
                {"from": "start", "to": "check"},
                {"from": "check", "to": "auto_approve", "condition": "getVariable('amount') < 10000"},
                {"from": "check", "to": "manual_approve", "condition": "getVariable('amount') >= 10000"},
                {"from": "manual_approve", "to": "end_approved", "condition": "taskResult == 'APPROVE'"},
                {"from": "manual_approve", "to": "end_rejected", "condition": "taskResult == 'REJECT'"}
              ]
            }
            """;
    }

    @Test
    void startProcessAutoApprove() {
        // Setup
        ProcessDefinition def = new ProcessDefinition();
        def.setId(1L);
        def.setCode("test_approval");
        def.setStatus(DefinitionStatus.ACTIVE);
        def.setDslJson(approvalDslJson);

        when(definitionRepository.findByCodeAndStatus("test_approval", DefinitionStatus.ACTIVE))
            .thenReturn(Optional.of(def));
        when(instanceRepository.save(any(ProcessInstance.class)))
            .thenAnswer(invocation -> {
                ProcessInstance inst = invocation.getArgument(0);
                inst.setId(1L);
                return inst;
            });
        when(historyRepository.save(any()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // Execute - amount < 10000, should auto-approve
        Map<String, Object> variables = Map.of("amount", 5000);
        ProcessInstance result = engine.startProcess("test_approval", "user01", "order-001", variables);

        // Verify
        assertNotNull(result);
        assertEquals(InstanceStatus.COMPLETED, result.getStatus());
        assertEquals("auto_approve", result.getCurrentNodeId());

        verify(instanceRepository, atLeastOnce()).save(any());
        verify(historyRepository, atLeastOnce()).save(any());
    }

    @Test
    void startProcessManualApproval() {
        // Setup
        ProcessDefinition def = new ProcessDefinition();
        def.setId(1L);
        def.setCode("test_approval");
        def.setStatus(DefinitionStatus.ACTIVE);
        def.setDslJson(approvalDslJson);

        when(definitionRepository.findByCodeAndStatus("test_approval", DefinitionStatus.ACTIVE))
            .thenReturn(Optional.of(def));

        // Mock instance save to assign IDs
        when(instanceRepository.save(any(ProcessInstance.class)))
            .thenAnswer(invocation -> {
                ProcessInstance inst = invocation.getArgument(0);
                inst.setId(1L);
                return inst;
            });

        // Mock task save
        when(taskRepository.save(any(ProcessTask.class)))
            .thenAnswer(invocation -> {
                ProcessTask task = invocation.getArgument(0);
                task.setId(1L);
                return task;
            });
        when(taskRepository.findByInstanceId(any()))
            .thenReturn(new ArrayList<>());

        when(historyRepository.save(any()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // Execute - amount >= 10000, should create task
        Map<String, Object> variables = Map.of("amount", 20000);
        ProcessInstance result = engine.startProcess("test_approval", "user01", "order-002", variables);

        // Verify
        assertNotNull(result);
        assertEquals(InstanceStatus.RUNNING, result.getStatus());
        assertEquals("manual_approve", result.getCurrentNodeId());

        verify(taskRepository, atLeastOnce()).save(any(ProcessTask.class));
    }

    @Test
    void evaluateConditionSimple() {
        Map<String, Object> variables = Map.of("amount", 5000);
        ProcessInstance instance = new ProcessInstance();
        instance.setTasks(new ArrayList<>());

        boolean result = engine.evaluateCondition("getVariable('amount') < 10000", variables, instance);
        assertTrue(result);

        result = engine.evaluateCondition("getVariable('amount') > 10000", variables, instance);
        assertFalse(result);
    }

    @Test
    void cancelProcess() {
        ProcessInstance instance = new ProcessInstance();
        instance.setId(1L);
        instance.setStatus(InstanceStatus.RUNNING);
        instance.setCurrentNodeId("task1");

        when(instanceRepository.findById(1L)).thenReturn(Optional.of(instance));
        when(instanceRepository.save(any())).thenReturn(instance);
        when(taskRepository.findByInstanceId(1L)).thenReturn(new ArrayList<>());
        when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        engine.cancelProcess(1L, "admin", "test cancel");

        assertEquals(InstanceStatus.CANCELLED, instance.getStatus());
        verify(instanceRepository).save(instance);
    }

    @Test
    void cancelNonRunningInstanceThrows() {
        ProcessInstance instance = new ProcessInstance();
        instance.setId(1L);
        instance.setStatus(InstanceStatus.COMPLETED);

        when(instanceRepository.findById(1L)).thenReturn(Optional.of(instance));

        assertThrows(ProcessEngineException.class,
            () -> engine.cancelProcess(1L, "admin", "cancel"));
    }

    @Test
    void completeTaskInvalidStatus() {
        ProcessTask task = new ProcessTask();
        task.setId(1L);
        task.setStatus(TaskStatus.COMPLETED);
        task.setAssigneeId("user01");

        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));

        assertThrows(ProcessEngineException.class,
            () -> engine.completeTask(1L, "user01", "APPROVE", "ok", null));
    }

    @Test
    void completeTaskWrongAssignee() {
        ProcessTask task = new ProcessTask();
        task.setId(1L);
        task.setStatus(TaskStatus.PENDING);
        task.setAssigneeId("user01");

        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));

        assertThrows(ProcessEngineException.class,
            () -> engine.completeTask(1L, "wrong_user", "APPROVE", "ok", null));
    }
}
