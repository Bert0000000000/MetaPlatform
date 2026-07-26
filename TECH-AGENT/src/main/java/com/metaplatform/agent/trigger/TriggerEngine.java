package com.metaplatform.agent.trigger;

import com.metaplatform.agent.deerflow.DeerFlowAdapter;
import com.metaplatform.agent.deerflow.DeerFlowAdapter.StartRunRequest;
import com.metaplatform.msg.consumer.EventEnvelope;
import com.metaplatform.msg.consumer.EventTopicListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Trigger Engine（P7.1）。
 *
 * <p>统一订阅所有 Ontology Event Topic，按 {@link TriggerEntity} 配置触发 Agent Run。
 * 支持 budget / cooldown 防触风暴。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TriggerEngine {

    private final TriggerRepository triggerRepository;
    private final DeerFlowAdapter deerFlowAdapter;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @EventTopicListener(
            topics = {"ontology.domain.event", "kb.document.uploaded"},
            group = "agent-trigger-engine",
            concurrency = 4,
            retries = 3,
            dlq = true
    )
    public void onEvent(EventEnvelope<Map<String, Object>> envelope) {
        String topic = envelope.eventType();
        List<TriggerEntity> triggers = triggerRepository.findByEnabledTrueAndEventTopic(topic);
        for (TriggerEntity t : triggers) {
            if (!match(t.getEventFilter(), envelope.payload())) continue;
            if (t.getCooldownSec() > 0 && t.getLastFireAt() != null
                    && Duration.between(t.getLastFireAt(), Instant.now()).getSeconds() < t.getCooldownSec()) {
                log.debug("[TriggerEngine] cooldown skip trigger={}", t.getTriggerCode());
                continue;
            }
            fire(t, envelope);
            t.setLastFireAt(Instant.now());
            t.setFireCount(t.getFireCount() + 1);
            triggerRepository.save(t);
        }
    }

    /** P7.2 Public API for unit tests + event-bus filter evaluation. */
    public boolean match(String filterJson, Map<String, Object> payload) {
        if (filterJson == null || filterJson.isBlank()) return true;
        // 简化：直接 JSON 对比
        try {
            Map<String, Object> filter = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(filterJson, Map.class);
            for (Map.Entry<String, Object> e : filter.entrySet()) {
                if (!Objects.equals(payload == null ? null : payload.get(e.getKey()), e.getValue())) {
                    return false;
                }
            }
            return true;
        } catch (Exception ex) {
            return true;
        }
    }

    private void fire(TriggerEntity t, EventEnvelope<Map<String, Object>> envelope) {
        String message = renderTemplate(t.getInputTemplate(), envelope);
        Map<String, Object> ontologyEnvelope = Map.of(
                "envelopeId", "ENV-" + UUID.randomUUID(),
                "tenantId", envelope.tenantId(),
                "subject", Map.of(
                        "conceptCode", String.valueOf(envelope.payload() == null ? "" : envelope.payload().get("conceptCode")),
                        "objectId", String.valueOf(envelope.payload() == null ? "" : envelope.payload().get("objectId"))
                )
        );
        StartRunRequest req = StartRunRequest.builder()
                .tenantId(envelope.tenantId())
                .userId("system-trigger")
                .agentId(t.getAgentId())
                .threadId("trigger-" + UUID.randomUUID())
                .message(message)
                .ontologyEnvelope(ontologyEnvelope)
                .allowedTools(List.of(
                        "ontology.describe_concept",
                        "ontology.search_objects",
                        "ontology.query_metric",
                        "ontology.propose_action"
                ))
                .build();
        String runId = deerFlowAdapter.startRun(req);
        log.info("[TriggerEngine] fired trigger={} -> runId={}", t.getTriggerCode(), runId);
    }

    private String renderTemplate(String tpl, EventEnvelope<Map<String, Object>> env) {
        if (tpl == null || tpl.isBlank()) return "Event: " + env.eventType();
        return tpl.replace("{{eventType}}", String.valueOf(env.eventType()))
                .replace("{{tenantId}}", String.valueOf(env.tenantId()))
                .replace("{{payload}}", String.valueOf(env.payload()));
    }
}
