package com.metaplatform.agent.evidence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.evidence.dto.EvidenceDto;
import com.metaplatform.agent.runs.AgentRunEntity;
import com.metaplatform.agent.runs.AgentRunService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EvidenceService {
    private final EvidenceRepository repository;
    private final AgentRunService runService;

    @Transactional(readOnly = true)
    public List<EvidenceDto> list(String runId) {
        AgentRunEntity run = runService.require(runId);
        if (run.getContextEnvelopeId() == null) return List.of();
        return repository.findByEnvelopeId(run.getContextEnvelopeId()).stream().map(this::toDto).toList();
    }
    @Transactional
    public EvidenceEntity captureToolResult(String runId, String envelopeId, String toolName,
                                            Map<String, Object> input, Map<String, Object> result) {
        EvidenceType type = switch (toolName) {
            case "ontology.query_metric" -> EvidenceType.ONTOLOGY_METRIC;
            case "ontology.get_object_graph" -> EvidenceType.ONTOLOGY_RELATION;
            default -> EvidenceType.ONTOLOGY_OBJECT;
        };
        String objectId = input != null && input.get("objectId") != null ? String.valueOf(input.get("objectId")) : null;
        String fragment = String.valueOf(result);
        if (fragment.length() > 4096) fragment = fragment.substring(0, 4096);
        return repository.save(EvidenceEntity.builder()
                .evidenceId("EVD-" + UUID.randomUUID().toString().replace("-", ""))
                .type(type).ref("ontology://tool/" + toolName).fragment(fragment)
                .sourceUri("ontology://run/" + runId).capturedAt(java.time.Instant.now())
                .capturedBy("agent." + runId).objectId(objectId).toolCallId(toolName)
                .envelopeId(envelopeId).build());
    }

    @Transactional
    public EvidenceEntity recordExecution(com.metaplatform.agent.action.ActionProposalEntity proposal, String envelopeId, String actor) {
        EvidenceEntity e = EvidenceEntity.builder()
                .evidenceId("EVD-" + UUID.randomUUID().toString().replace("-", ""))
                .type(EvidenceType.ONTOLOGY_OBJECT)
                .ref("action://executed/" + proposal.getActionCode() + "/" + proposal.getProposalId())
                .fragment("Action executed: " + proposal.getActionCode() + " status=" + proposal.getStatus() + " idempotency=" + proposal.getIdempotencyKey())
                .sourceUri("action://proposal/" + proposal.getProposalId())
                .capturedAt(java.time.Instant.now())
                .capturedBy(actor == null ? "system" : actor)
                .toolCallId(proposal.getActionCode())
                .envelopeId(envelopeId)
                .build();
        return repository.save(e);
    }

    private EvidenceDto toDto(EvidenceEntity e) { return EvidenceDto.builder().evidenceId(e.getEvidenceId()).type(e.getType().name())
            .ref(e.getRef()).fragment(e.getFragment()).sourceUri(e.getSourceUri()).capturedAt(e.getCapturedAt())
            .capturedBy(e.getCapturedBy()).concept(e.getConcept()).objectId(e.getObjectId()).toolCallId(e.getToolCallId())
            .envelopeId(e.getEnvelopeId()).build(); }
}
