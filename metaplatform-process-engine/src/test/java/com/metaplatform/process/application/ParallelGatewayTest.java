package com.metaplatform.process.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.metaplatform.process.domain.ParallelToken;
import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.dsl.*;
import com.metaplatform.process.domain.enums.*;
import com.metaplatform.process.domain.repository.*;
import com.metaplatform.process.infrastructure.util.JsonUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for parallel gateway execution.
 * Verifies that all branches are created and join works correctly.
 */
@ExtendWith(MockitoExtension.class)
class ParallelGatewayTest {

    @Mock
    private ProcessInstanceRepository instanceRepository;
    @Mock
    private ProcessDefinitionRepository definitionRepository;
    @Mock
    private ProcessTaskRepository taskRepository;
    @Mock
    private ProcessHistoryRepository historyRepository;
    @Mock
    private ParallelTokenRepository parallelTokenRepository;

    private ProcessEngine engine;
    private DslParser dslParser;

    private String parallelDslJson;

    @BeforeEach
    void setUp() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        dslParser = new DslParser(mapper);
        DefinitionValidator validator = new DefinitionValidator();
        ParticipantResolver participantResolver = new ParticipantResolver();
        SlaTracker slaTracker = mock(SlaTracker.class);
        AiDecisionService aiDecisionService = mock(AiDecisionService.class);

        engine = new ProcessEngine(instanceRepository, definitionRepository,
            taskRepository, historyRepository, parallelTokenRepository,
            dslParser, validator, participantResolver, slaTracker, aiDecisionService);

        // DSL with parallel gateway: start -> parallel_split -> [branch_a, branch_b, branch_c] -> parallel_join -> end
        parallelDslJson = """
            {
              "key": "test_parallel",
              "name": "Test Parallel Process",
              "nodes": [
                {"id": "start", "type": "START", "name": "Start"},
                {"id": "parallel_split", "type": "GATEWAY", "name": "Parallel Split", "gatewayType": "PARALLEL"},
                {"id": "task_a", "type": "TASK", "name": "Task A", "assignee": {"type": "USER", "value": "user01"}},
                {"id": "task_b", "type": "TASK", "name": "Task B", "assignee": {"type": "USER", "value": "user02"}},
                {"id": "task_c", "type": "TASK", "name": "Task C", "assignee": {"type": "USER", "value": "user03"}},
                {"id": "parallel_join", "type": "GATEWAY", "name": "Parallel Join", "gatewayType": "PARALLEL"},
                {"id": "end", "type": "END", "name": "End", "action": {"type": "SET_VARIABLE", "variable": "status", "value": "DONE"}}
              ],
              "transitions": [
                {"from": "start", "to": "parallel_split"},
                {"from": "parallel_split", "to": "task_a"},
                {"from": "parallel_split", "to": "task_b"},
                {"from": "parallel_split", "to": "task_c"},
                {"from": "task_a", "to": "parallel_join"},
                {"from": "task_b", "to": "parallel_join"},
                {"from": "task_c", "to": "parallel_join"},
                {"from": "parallel_join", "to": "end"}
              ]
            }
            """;
    }

    @Test
    void parallelGatewayCreatesTokensForAllBranches() {
        // Setup
        ProcessDefinition def = new ProcessDefinition();
        def.setId(1L);
        def.setCode("test_parallel");
        def.setStatus(DefinitionStatus.ACTIVE);
        def.setDslJson(parallelDslJson);

        when(definitionRepository.findByCodeAndStatus("test_parallel", DefinitionStatus.ACTIVE))
            .thenReturn(Optional.of(def));

        when(instanceRepository.save(any(ProcessInstance.class)))
            .thenAnswer(invocation -> {
                ProcessInstance inst = invocation.getArgument(0);
                inst.setId(1L);
                return inst;
            });

        when(parallelTokenRepository.save(any(ParallelToken.class)))
            .thenAnswer(invocation -> {
                ParallelToken token = invocation.getArgument(0);
                token.setId(new Random().nextLong(1, 1000));
                return token;
            });

        when(taskRepository.save(any()))
            .thenAnswer(invocation -> {
                var task = invocation.getArgument(0);
                return task;
            });
        when(taskRepository.findByInstanceId(any()))
            .thenReturn(new ArrayList<>());

        when(historyRepository.save(any()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // Execute
        Map<String, Object> variables = Map.of();
        ProcessInstance result = engine.startProcess("test_parallel", "user01", "parallel-001", variables);

        // Verify: 3 tokens were created for 3 branches
        ArgumentCaptor<ParallelToken> tokenCaptor = ArgumentCaptor.forClass(ParallelToken.class);
        verify(parallelTokenRepository, times(3)).save(tokenCaptor.capture());

        List<ParallelToken> capturedTokens = tokenCaptor.getAllValues();
        Set<String> targetNodeIds = new HashSet<>();
        for (ParallelToken token : capturedTokens) {
            assertEquals(1L, token.getInstanceId());
            assertEquals("parallel_split", token.getGatewayNodeId());
            assertEquals(ParallelToken.TokenStatus.ACTIVE, token.getStatus());
            targetNodeIds.add(token.getTargetNodeId());
        }

        // All 3 branch targets should be present
        assertTrue(targetNodeIds.contains("task_a"));
        assertTrue(targetNodeIds.contains("task_b"));
        assertTrue(targetNodeIds.contains("task_c"));

        assertNotNull(result);
    }

    @Test
    void parallelBranchCompletionMarksTokenAsCompleted() {
        // Setup: mock tokens
        ParallelToken tokenA = new ParallelToken();
        tokenA.setId(1L);
        tokenA.setInstanceId(1L);
        tokenA.setGatewayNodeId("parallel_split");
        tokenA.setBranchId("parallel_split_branch_0");
        tokenA.setTargetNodeId("task_a");
        tokenA.setStatus(ParallelToken.TokenStatus.ACTIVE);

        when(parallelTokenRepository.findByInstanceIdAndGatewayNodeId(1L, "parallel_split"))
            .thenReturn(List.of(tokenA));
        when(parallelTokenRepository.save(any(ParallelToken.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        // Execute
        engine.completeParallelBranch(1L, "parallel_split", "parallel_split_branch_0");

        // Verify
        assertEquals(ParallelToken.TokenStatus.COMPLETED, tokenA.getStatus());
        assertNotNull(tokenA.getCompletedAt());
        verify(parallelTokenRepository).save(tokenA);
    }

    @Test
    void parallelJoinWaitsForAllBranches() {
        // Setup: 2 out of 3 completed
        ProcessDsl dsl = dslParser.parse(parallelDslJson);

        ProcessInstance instance = new ProcessInstance();
        instance.setId(1L);
        instance.setCurrentNodeId("parallel_join");
        instance.setStatus(InstanceStatus.RUNNING);
        instance.setVariablesJson("{}");

        when(parallelTokenRepository.countByInstanceIdAndGatewayNodeId(1L, "parallel_split"))
            .thenReturn(3L);
        when(parallelTokenRepository.countByInstanceIdAndGatewayNodeIdAndStatus(
            1L, "parallel_split", ParallelToken.TokenStatus.COMPLETED))
            .thenReturn(2L);

        // Execute: check join -- should NOT trigger join yet (only 2/3)
        engine.checkParallelJoin(instance, dsl, "parallel_split");

        // Verify: no node transition (not all branches done)
        verify(instanceRepository, never()).save(any());
    }

    @Test
    void parallelJoinProceedsWhenAllBranchesComplete() {
        // Setup: all 3 completed
        ProcessDsl dsl = dslParser.parse(parallelDslJson);

        ProcessInstance instance = new ProcessInstance();
        instance.setId(1L);
        instance.setCurrentNodeId("parallel_join");
        instance.setStatus(InstanceStatus.RUNNING);
        instance.setVariablesJson("{}");

        when(parallelTokenRepository.countByInstanceIdAndGatewayNodeId(1L, "parallel_split"))
            .thenReturn(3L);
        when(parallelTokenRepository.countByInstanceIdAndGatewayNodeIdAndStatus(
            1L, "parallel_split", ParallelToken.TokenStatus.COMPLETED))
            .thenReturn(3L);
        when(instanceRepository.save(any()))
            .thenAnswer(inv -> inv.getArgument(0));
        when(historyRepository.save(any()))
            .thenAnswer(inv -> inv.getArgument(0));

        // Execute: check join -- should trigger join (3/3)
        engine.checkParallelJoin(instance, dsl, "parallel_split");

        // Verify: instance was advanced
        verify(instanceRepository, atLeastOnce()).save(any());
    }

    @Test
    void parallelTokenMarkFailed() {
        ParallelToken token = new ParallelToken();
        token.setId(1L);
        token.setInstanceId(1L);
        token.setStatus(ParallelToken.TokenStatus.ACTIVE);

        token.markFailed();

        assertEquals(ParallelToken.TokenStatus.FAILED, token.getStatus());
        assertNotNull(token.getCompletedAt());
        assertFalse(token.isActive());
    }
}
