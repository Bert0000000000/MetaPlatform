package com.metaplatform.agent.tools;

import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.context.OntologyContextEnvelopeSigner;
import com.metaplatform.agent.context.OntologyContextRegistry;
import com.metaplatform.agent.clients.OntologyClient;
import com.metaplatform.agent.evidence.EvidenceService;
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
        Map<String, Object> data = ontologyClient.invokeGroundTool(toolName, envelope.envelopeId(), request.getInput(),
                envelope.tenantId(), envelope.runId());
        var evidence = evidenceService.captureToolResult(envelope.runId(), envelope.envelopeId(), toolName, request.getInput(), data);
        return Map.of("toolName", toolName, "envelopeId", envelope.envelopeId(),
                "ontologyVersion", envelope.ontologyVersion(), "evidenceId", evidence.getEvidenceId(), "data", data);
    }
}
