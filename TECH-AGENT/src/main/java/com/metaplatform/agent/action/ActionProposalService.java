package com.metaplatform.agent.action;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.action.dto.*;
import com.metaplatform.agent.runs.AgentRunService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ActionProposalService {
    private final ActionProposalRepository repository;
    private final AgentRunService runService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ActionProposalDto create(ActionProposalCreateRequest request) {
        runService.require(request.getRunId());
        if (request.getEvidenceRefs() == null || request.getEvidenceRefs().isEmpty()) {
            throw Phase1Exception.badRequest("EVIDENCE_REQUIRED", "evidenceRefs must contain at least one reference");
        }
        if (request.getTargetObjects() == null || request.getTargetObjects().isEmpty()) {
            throw Phase1Exception.badRequest("TARGET_OBJECTS_REQUIRED", "targetObjects must contain at least one object");
        }
        RiskLevel risk = parseRisk(request.getRiskLevel());
        String key = hash(request.getRunId(), request.getActionCode(), request.getTargetObjects(), request.getParameters());
        if (repository.findByIdempotencyKey(key).isPresent()) {
            throw Phase1Exception.conflict("IDEMPOTENCY_KEY_CONFLICT", "An action proposal already exists for this request");
        }
        Instant now = Instant.now();
        ActionProposalEntity entity = ActionProposalEntity.builder().proposalId("PROP-" + UUID.randomUUID().toString().replace("-", ""))
                .runId(request.getRunId()).taskId(request.getTaskId()).actionCode(request.getActionCode())
                .targetObjects(json(request.getTargetObjects())).parameters(json(request.getParameters()))
                .reason(request.getReason()).evidenceRefs(json(request.getEvidenceRefs())).riskLevel(risk)
                .approvalRequired(risk != RiskLevel.LOW).idempotencyKey(key).status(ActionProposalStatus.PROPOSED)
                .proposedAt(now).expiresAt(now.plusSeconds(7 * 24 * 3600L)).createdAt(now).updatedAt(now).build();
        return toDto(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public ActionProposalDto get(String proposalId) {
        return repository.findById(proposalId).map(this::toDto).orElseThrow(() ->
                Phase1Exception.notFound("ACTION_PROPOSAL_NOT_FOUND", "Action proposal not found: " + proposalId));
    }

    private RiskLevel parseRisk(String value) {
        if (value == null || value.isBlank()) return RiskLevel.MEDIUM;
        try { return RiskLevel.valueOf(value.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ex) { throw Phase1Exception.badRequest("INVALID_RISK_LEVEL", "Unknown risk level: " + value); }
    }
    private String json(Object value) { try { return objectMapper.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalStateException(e); } }
    private String hash(Object... values) {
        try { byte[] bytes = MessageDigest.getInstance("SHA-256").digest(json(Arrays.asList(values)).getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder(); for (byte x : bytes) b.append(String.format("%02x", x)); return b.toString(); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    private ActionProposalDto toDto(ActionProposalEntity e) { return ActionProposalDto.builder().proposalId(e.getProposalId()).runId(e.getRunId())
            .taskId(e.getTaskId()).actionCode(e.getActionCode()).targetObjects(readList(e.getTargetObjects()))
            .parameters(readMap(e.getParameters())).reason(e.getReason()).evidenceRefs(readList(e.getEvidenceRefs()))
            .riskLevel(e.getRiskLevel().name()).approvalRequired(e.isApprovalRequired()).idempotencyKey(e.getIdempotencyKey())
            .status(e.getStatus().name()).decidedBy(e.getDecidedBy()).decisionAt(e.getDecisionAt()).decisionReason(e.getDecisionReason())
            .proposedAt(e.getProposedAt()).expiresAt(e.getExpiresAt()).build(); }
    private List<String> readList(String value) { try { return objectMapper.readValue(value, new TypeReference<>() {}); } catch (Exception e) { return List.of(); } }
    private Map<String,Object> readMap(String value) { try { return objectMapper.readValue(value, new TypeReference<>() {}); } catch (Exception e) { return Map.of(); } }
}
