package com.metaplatform.agent.deerflow;

import com.metaplatform.agent.runs.AgentRunService;
import com.metaplatform.agent.runs.dto.AgentRunDto;
import com.metaplatform.agent.runs.dto.CreateAgentRunRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Objects;

/** Persists the authoritative platform run before starting DeerFlow. */
@Service
@RequiredArgsConstructor
public class DeerFlowRunOrchestrator {
    private final AgentRunService agentRunService;
    private final DeerFlowAdapter adapter;

    public StartResult start(DeerFlowAdapter.StartRunRequest request) {
        String envelopeId = request.getOntologyEnvelope() == null ? null
                : Objects.toString(request.getOntologyEnvelope().get("envelopeId"), null);
        if (envelopeId == null || envelopeId.isBlank()) {
            throw new DeerFlowException("ENVELOPE_REQUIRED", "Signed ontology envelopeId is required", 400, null);
        }
        AgentRunDto platformRun = agentRunService.create(CreateAgentRunRequest.builder()
                .agentId(request.getAgentId()).goal(request.getMessage()).envelopeId(envelopeId)
                .runtimeType("DEERFLOW").build());
        request.setPlatformRunId(platformRun.getRunId());
        request.setTraceId(platformRun.getTraceId());
        try {
            String deerFlowRunId = adapter.startRun(request);
            AgentRunDto bound = agentRunService.bindDeerFlow(platformRun.getRunId(), request.getThreadId(), deerFlowRunId);
            return new StartResult(bound.getRunId(), deerFlowRunId, request.getThreadId(), "DEERFLOW", bound.getTraceId());
        } catch (DeerFlowException error) {
            agentRunService.complete(platformRun.getRunId(), "FAILED", null, error.getCode(), error.getMessage());
            throw error;
        }
    }

    public record StartResult(String platformRunId, String deerFlowRunId, String threadId,
                              String selectedRuntime, String traceId) {}
}
