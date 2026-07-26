package com.metaplatform.agent.evidence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.evidence.dto.ClaimDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ClaimService {
    private final ClaimRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<ClaimDto> list(String runId) { return repository.findByRunIdOrderByCreatedAtAsc(runId).stream().map(this::toDto).toList(); }
    @Transactional
    public ClaimEntity createToolClaim(String runId, String toolName, String evidenceId, String content) {
        if (runId == null || runId.isBlank() || evidenceId == null || evidenceId.isBlank())
            throw new IllegalArgumentException("runId and evidenceId are required");
        try {
            String refs = objectMapper.writeValueAsString(List.of(evidenceId));
            return repository.save(ClaimEntity.builder().claimId("CLM-" + UUID.randomUUID().toString().replace("-", ""))
                    .runId(runId).type(ClaimType.FACT).content(content == null ? toolName : content)
                    .confidence(java.math.BigDecimal.valueOf(0.9)).evidenceRefs(refs)
                    .generatedByAgentId("ontology-tool").generatedByModel("ontology")
                    .toolCallIds(objectMapper.writeValueAsString(List.of(toolName))).createdAt(java.time.Instant.now()).build());
        } catch (Exception ex) { throw new IllegalStateException("unable to persist tool claim", ex); }
    }

    @Transactional
    public ClaimEntity recordExecution(com.metaplatform.agent.action.ActionProposalEntity proposal, String envelopeId) {
        try {
            String refs = objectMapper.writeValueAsString(List.of("EVD-exec-" + proposal.getProposalId()));
            return repository.save(ClaimEntity.builder().claimId("CLM-" + UUID.randomUUID().toString().replace("-", ""))
                    .runId(proposal.getRunId()).type(ClaimType.FACT)
                    .content("Action executed: " + proposal.getActionCode() + " (idempotency=" + proposal.getIdempotencyKey() + ")")
                    .confidence(java.math.BigDecimal.valueOf(0.95)).evidenceRefs(refs)
                    .generatedByAgentId("action-executor").generatedByModel("tech-action")
                    .toolCallIds(objectMapper.writeValueAsString(List.of(proposal.getActionCode())))
                    .createdAt(java.time.Instant.now()).build());
        } catch (Exception ex) { throw new IllegalStateException("unable to persist execution claim", ex); }
    }

    private ClaimDto toDto(ClaimEntity e) {
        Map<String,String> generatedBy = new LinkedHashMap<>();
        generatedBy.put("agentId", e.getGeneratedByAgentId()); generatedBy.put("model", e.getGeneratedByModel());
        return ClaimDto.builder().claimId(e.getClaimId()).runId(e.getRunId()).taskId(e.getTaskId()).type(e.getType().name())
                .content(e.getContent()).confidence(e.getConfidence()).evidenceRefs(readList(e.getEvidenceRefs()))
                .generatedBy(generatedBy).createdAt(e.getCreatedAt()).toolCallIds(readList(e.getToolCallIds()))
                .promptSnapshotId(e.getPromptSnapshotId()).build();
    }
    private List<String> readList(String json) { if (json == null || json.isBlank()) return List.of(); try { return objectMapper.readValue(json, new TypeReference<>() {}); } catch (Exception ignored) { return List.of(); } }
}
