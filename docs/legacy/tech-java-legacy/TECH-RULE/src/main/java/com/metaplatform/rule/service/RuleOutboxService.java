package com.metaplatform.rule.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.TraceContext;
import com.metaplatform.rule.entity.RuleOutboxMessageEntity;
import com.metaplatform.rule.repository.RuleOutboxMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * P1-RULE-03：规则执行事件 Outbox 服务。
 *
 * <p>规则命中后调用 {@link #publishEvent} 将 RULE_EXECUTED 事件写入
 * {@code rule_outbox_messages} 表，后台 {@link #relay} 定时轮询并投递到 Kafka。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleOutboxService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_SENT = "SENT";
    private static final String STATUS_FAILED = "FAILED";
    private static final String TOPIC_PREFIX = "metaplatform.";
    private static final String TRACE_ID_HEADER = "X-Trace-Id";
    private static final String AGGREGATE_TYPE = "Rule";
    private static final String EVENT_TYPE = "RULE_EXECUTED";

    private final RuleOutboxMessageRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 发布规则执行事件（与业务事务同事务）。
     */
    @Transactional
    public void publishEvent(String tenantId, String rulesetId, String ruleId,
                             String ruleCode, boolean matched, Map<String, Object> inputData) {
        try {
            Map<String, Object> payload = Map.of(
                    "tenantId", tenantId,
                    "rulesetId", rulesetId,
                    "ruleId", ruleId,
                    "ruleCode", ruleCode,
                    "matched", matched,
                    "inputData", inputData,
                    "traceId", TraceContext.getOrCreate(),
                    "eventTime", Instant.now().toString()
            );
            Map<String, String> headers = Map.of(TRACE_ID_HEADER, TraceContext.getOrCreate());

            RuleOutboxMessageEntity entity = RuleOutboxMessageEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .aggregateType(AGGREGATE_TYPE)
                    .aggregateId(ruleId)
                    .eventType(EVENT_TYPE)
                    .payload(objectMapper.writeValueAsString(payload))
                    .headers(objectMapper.writeValueAsString(headers))
                    .status(STATUS_PENDING)
                    .retryCount(0)
                    .maxRetries(3)
                    .build();

            outboxRepository.save(entity);
            log.debug("Rule outbox event saved: ruleId={}, matched={}", ruleId, matched);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize rule outbox event", e);
        }
    }

    /**
     * 定时轮询 PENDING 消息投递到 Kafka（每 5 秒）。
     */
    @Scheduled(fixedDelay = 5000)
    public void relay() {
        List<RuleOutboxMessageEntity> pending;
        try {
            pending = outboxRepository.findTop50ByStatusOrderByCreatedAtAsc(STATUS_PENDING);
        } catch (Exception e) {
            log.error("Failed to fetch pending rule outbox messages: {}", e.getMessage());
            return;
        }
        if (pending == null || pending.isEmpty()) {
            return;
        }
        log.debug("Relaying {} pending rule outbox messages", pending.size());
        for (RuleOutboxMessageEntity msg : pending) {
            relayOne(msg);
        }
    }

    @Transactional
    public void relayOne(RuleOutboxMessageEntity msg) {
        try {
            String topic = TOPIC_PREFIX + msg.getAggregateType() + "." + msg.getEventType();
            ProducerRecord<String, String> record =
                    new ProducerRecord<>(topic, msg.getAggregateId(), msg.getPayload());

            String traceId = extractTraceId(msg.getHeaders());
            if (traceId != null) {
                record.headers().add(TRACE_ID_HEADER, traceId.getBytes(StandardCharsets.UTF_8));
            }

            kafkaTemplate.send(record).get(10, TimeUnit.SECONDS);

            msg.setStatus(STATUS_SENT);
            msg.setSentAt(Instant.now());
            outboxRepository.save(msg);
            log.debug("Rule outbox message sent: id={}, topic={}", msg.getId(), topic);
        } catch (Exception e) {
            int newRetry = msg.getRetryCount() + 1;
            msg.setRetryCount(newRetry);
            if (newRetry >= msg.getMaxRetries()) {
                msg.setStatus(STATUS_FAILED);
                log.error("Rule outbox message failed: id={}, retryCount={}", msg.getId(), newRetry);
            } else {
                msg.setNextRetryAt(Instant.now().plusSeconds(newRetry * 30L));
                log.warn("Rule outbox message retry scheduled: id={}, retryCount={}, error={}",
                        msg.getId(), newRetry, e.getMessage());
            }
            outboxRepository.save(msg);
        }
    }

    private String extractTraceId(String headersJson) {
        if (headersJson == null || headersJson.isBlank()) {
            return TraceContext.getOrCreate();
        }
        try {
            Map<String, String> headers = objectMapper.readValue(headersJson, new TypeReference<>() {});
            String traceId = headers.get(TRACE_ID_HEADER);
            return traceId != null ? traceId : TraceContext.getOrCreate();
        } catch (JsonProcessingException e) {
            return TraceContext.getOrCreate();
        }
    }
}
