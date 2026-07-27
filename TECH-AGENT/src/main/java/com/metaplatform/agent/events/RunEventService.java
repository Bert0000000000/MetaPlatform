package com.metaplatform.agent.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.events.dto.RunEventDto;
import com.metaplatform.agent.runs.AgentRunEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class RunEventService {
    private final RunEventRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public RunEventEntity record(AgentRunEntity run, String type, Map<String, Object> payload) {
        RunEventEntity last = repository.findByRunIdOrderBySeqAsc(run.getRunId()).stream().reduce((a,b) -> b).orElse(null);
        long seq = last == null ? 1L : last.getSeq() + 1;
        Instant ts = Instant.now();
        if (last != null && !ts.isAfter(last.getTs())) ts = last.getTs().plusNanos(1);
        RunEventEntity event = RunEventEntity.builder().eventId("EVT-" + UUID.randomUUID().toString().replace("-", ""))
                .runId(run.getRunId()).type(RunEventType.valueOf(type)).ts(ts).traceId(run.getTraceId())
                .tenantId(run.getTenantId()).envelopeId(run.getContextEnvelopeId()).payload(json(payload)).seq(seq)
                .createdAt(ts).build();
        return repository.saveAndFlush(event); // RE-2: durable before any caller forwards it.
    }

    @Transactional(readOnly = true)
    public List<RunEventDto> list(String runId, Long afterSeq, List<RunEventType> types) {
        List<RunEventEntity> events = afterSeq == null
                ? repository.findByRunIdOrderBySeqAsc(runId)
                : repository.findByRunIdAndSeqGreaterThanOrderBySeqAsc(runId, afterSeq);
        if (types != null && !types.isEmpty()) events = events.stream().filter(e -> types.contains(e.getType())).toList();
        return events.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<RunEventDto> listForTenant(String tenantId, String runId, Long afterSeq) {
        return list(runId, afterSeq, null).stream()
                .filter(event -> java.util.Objects.equals(tenantId, event.getTenantId()))
                .toList();
    }

    private RunEventDto toDto(RunEventEntity e) {
        return RunEventDto.builder().eventId(e.getEventId()).runId(e.getRunId()).taskId(e.getTaskId())
                .subAgentId(e.getSubAgentId()).parentRunId(e.getParentRunId()).type(e.getType().name())
                .ts(e.getTs()).traceId(e.getTraceId()).tenantId(e.getTenantId()).envelopeId(e.getEnvelopeId())
                .seq(e.getSeq()).payload(parse(e.getPayload())).build();
    }
    private String json(Map<String,Object> value) { try { return objectMapper.writeValueAsString(value); } catch (JsonProcessingException e) { return "{}"; } }
    private Map<String,Object> parse(String value) { try { return objectMapper.readValue(value, new TypeReference<>() {}); } catch (Exception e) { return Map.of(); } }
}
