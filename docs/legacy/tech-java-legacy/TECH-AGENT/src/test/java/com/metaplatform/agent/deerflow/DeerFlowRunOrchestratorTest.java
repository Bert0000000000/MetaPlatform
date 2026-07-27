package com.metaplatform.agent.deerflow;

import com.metaplatform.agent.runs.AgentRunService;
import com.metaplatform.agent.runs.dto.AgentRunDto;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;

class DeerFlowRunOrchestratorTest {
    private final AgentRunService runs = Mockito.mock(AgentRunService.class);
    private final DeerFlowAdapter adapter = Mockito.mock(DeerFlowAdapter.class);
    private final DeerFlowRunOrchestrator orchestrator = new DeerFlowRunOrchestrator(runs, adapter);

    @Test
    void persistsPlatformRunBeforeStartingAndBindingUpstreamRun() {
        Mockito.when(runs.create(any())).thenReturn(AgentRunDto.builder().runId("RUN-1").traceId("trace-1").build());
        Mockito.when(adapter.startRun(any())).thenReturn("DF-1");
        Mockito.when(runs.bindDeerFlow("RUN-1", "thread-1", "DF-1"))
                .thenReturn(AgentRunDto.builder().runId("RUN-1").traceId("trace-1").build());
        var result = orchestrator.start(request());
        assertEquals("RUN-1", result.platformRunId());
        assertEquals("DF-1", result.deerFlowRunId());
        assertEquals("DEERFLOW", result.selectedRuntime());
        InOrder order = Mockito.inOrder(runs, adapter);
        order.verify(runs).create(any());
        order.verify(adapter).startRun(any());
        order.verify(runs).bindDeerFlow("RUN-1", "thread-1", "DF-1");
    }

    @Test
    void upstreamFailureTerminalizesAuthoritativeRunWithTypedCode() {
        Mockito.when(runs.create(any())).thenReturn(AgentRunDto.builder().runId("RUN-1").traceId("trace-1").build());
        Mockito.when(adapter.startRun(any())).thenThrow(new DeerFlowException("DEERFLOW_UNAVAILABLE", "down", null, null));
        assertThrows(DeerFlowException.class, () -> orchestrator.start(request()));
        Mockito.verify(runs).complete("RUN-1", "FAILED", null, "DEERFLOW_UNAVAILABLE", "down");
    }

    @Test
    void unsignedEnvelopeIsRejectedBeforeAnyPersistence() {
        var request = request(); request.setOntologyEnvelope(Map.of());
        assertEquals("ENVELOPE_REQUIRED", assertThrows(DeerFlowException.class, () -> orchestrator.start(request)).getCode());
        Mockito.verifyNoInteractions(runs, adapter);
    }

    private DeerFlowAdapter.StartRunRequest request() {
        return DeerFlowAdapter.StartRunRequest.builder().tenantId("t").userId("u").agentId("a")
                .threadId("thread-1").message("goal").ontologyEnvelope(Map.of("envelopeId", "ENV-1"))
                .allowedTools(List.of("ontology.get_object")).build();
    }
}
