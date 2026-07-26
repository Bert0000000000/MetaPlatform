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
