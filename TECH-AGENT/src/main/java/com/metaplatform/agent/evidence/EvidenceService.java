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
    private EvidenceDto toDto(EvidenceEntity e) { return EvidenceDto.builder().evidenceId(e.getEvidenceId()).type(e.getType().name())
            .ref(e.getRef()).fragment(e.getFragment()).sourceUri(e.getSourceUri()).capturedAt(e.getCapturedAt())
            .capturedBy(e.getCapturedBy()).concept(e.getConcept()).objectId(e.getObjectId()).toolCallId(e.getToolCallId())
            .envelopeId(e.getEnvelopeId()).build(); }
}
