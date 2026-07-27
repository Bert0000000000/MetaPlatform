package com.metaplatform.agent.tools;

import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.context.OntologyContextEnvelopeSigner;
import com.metaplatform.agent.context.OntologyContextRegistry;
import com.metaplatform.agent.clients.OntologyClient;
import com.metaplatform.agent.evidence.EvidenceService;
import com.metaplatform.agent.evidence.ClaimService;
import com.metaplatform.agent.events.RunEventService;
import com.metaplatform.agent.runs.AgentRunService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GroundToolService {
    private static final Set<String> SUPPORTED = Set.of(
            "ontology.search_objects", "ontology.query_metric",
            "ontology.get_object_graph", "ontology.fetch_evidence");
    private final OntologyContextRegistry registry;
    private final OntologyContextEnvelopeSigner signer;
    private final OntologyClient ontologyClient;
    private final EvidenceService evidenceService;
    private final ClaimService claimService;
    private final AgentRunService agentRunService;
    private final RunEventService runEventService;

    public Map<String, Object> invoke(String toolName, GroundToolRequest request) {
        if (!SUPPORTED.contains(toolName))
            throw Phase1Exception.forbidden("TOOL_NOT_IN_ALLOWLIST", "Tool is not allowed: " + toolName);
        var envelope = registry.get(request.getEnvelopeId())
                .orElseThrow(() -> Phase1Exception.notFound("ENVELOPE_NOT_FOUND", "Envelope not found or expired"));
        try { signer.verify(envelope); }
        catch (IllegalArgumentException ex) { throw Phase1Exception.forbidden("ENVELOPE_INVALID", ex.getMessage()); }
        if (!envelope.allowsTool(toolName))
            throw Phase1Exception.forbidden("TOOL_NOT_IN_ALLOWLIST", "Envelope does not allow tool: " + toolName);
        if (request.getInput().toString().length() > 16384)
            throw Phase1Exception.badRequest("TOOL_INPUT_TOO_LARGE", "Tool input exceeds 16KB");
        var run = agentRunService.require(envelope.runId());
        runEventService.record(run, "TOOL_STARTED", Map.of("toolName", toolName, "envelopeId", envelope.envelopeId()));
        Map<String, Object> data;
        try {
            data = ontologyClient.invokeGroundTool(toolName, envelope.envelopeId(), request.getInput(),
                    envelope.tenantId(), envelope.runId());
        } catch (RuntimeException ex) {
            runEventService.record(run, "TOOL_FAILED", Map.of("toolName", toolName, "error", ex.getMessage() == null ? "tool failed" : ex.getMessage()));
            throw ex;
        }
        runEventService.record(run, "TOOL_COMPLETED", Map.of("toolName", toolName));
        var evidence = evidenceService.captureToolResult(envelope.runId(), envelope.envelopeId(), toolName, request.getInput(), data);
        runEventService.record(run, "EVIDENCE_ATTACHED", Map.of("evidenceId", evidence.getEvidenceId(), "toolName", toolName));
        var claim = claimService.createToolClaim(envelope.runId(), toolName, evidence.getEvidenceId(),
                "Ontology tool result: " + toolName);
        runEventService.record(run, "CLAIM_PRODUCED", Map.of("claimId", claim.getClaimId(), "evidenceId", evidence.getEvidenceId()));
        return Map.of("toolName", toolName, "envelopeId", envelope.envelopeId(),
                "ontologyVersion", envelope.ontologyVersion(), "evidenceId", evidence.getEvidenceId(),
                "claimId", claim.getClaimId(), "data", data);
    }
}
