package com.metaplatform.wfe.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.entity.WfeOutboxMessageEntity;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.WfeOutboxMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Outbox 服务（P1-WFE-09）：将任务事件先写入 outbox 表，再由定时任务投递到 Kafka，
 * 保证事件不丢失（Outbox 模式）。Kafka 消息头包含 X-Trace-Id。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WfeOutboxService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final WfeOutboxMessageRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;

    /**
     * 写入 outbox 事件（与业务操作同事务）。
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void publishEvent(String tenantId, String aggregateId, String eventType,
                             Object payload, Map<String, String> headers) {
        try {
            WfeOutboxMessageEntity entity = WfeOutboxMessageEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .aggregateType("Task")
                    .aggregateId(aggregateId)
                    .eventType(eventType)
                    .payload(payload != null ? OBJECT_MAPPER.writeValueAsString(payload) : null)
                    .headers(headers != null ? OBJECT_MAPPER.writeValueAsString(headers) : null)
                    .status("PENDING")
                    .retryCount(0)
                    .maxRetries(3)
                    .build();
            outboxRepository.save(entity);
            log.debug("Outbox event persisted: id={}, eventType={}, aggregateId={}",
                    entity.getId(), eventType, aggregateId);
        } catch (Exception e) {
            log.error("Failed to persist outbox event: eventType={}, aggregateId={}, error={}",
                    eventType, aggregateId, e.getMessage());
            throw new WfeException(ErrorCode.OUTBOX_PUBLISH_FAILED, "事件发布失败: " + e.getMessage());
        }
    }

    /**
     * 定时轮询 PENDING 消息投递到 Kafka（每 5 秒）。
     */
    @Scheduled(fixedDelay = 5000)
    public void relay() {
        List<WfeOutboxMessageEntity> pending;
        try {
            pending = outboxRepository.findTop50ByStatusOrderByCreatedAtAsc("PENDING");
        } catch (Exception e) {
            log.error("Failed to fetch pending outbox messages: {}", e.getMessage());
            return;
        }
        if (pending == null || pending.isEmpty()) {
            return;
        }
        log.info("Relaying {} pending outbox messages", pending.size());
        for (WfeOutboxMessageEntity msg : pending) {
            relayOne(msg);
        }
    }

    @Transactional
    public void relayOne(WfeOutboxMessageEntity msg) {
        try {
            String topic = "metaplatform.Task." + msg.getEventType();
            ProducerRecord<String, String> record =
                    new ProducerRecord<>(topic, msg.getAggregateId(), msg.getPayload());
            String traceId = extractTraceId(msg.getHeaders());
            record.headers().add(TraceContext.TRACE_ID_HEADER, traceId.getBytes(StandardCharsets.UTF_8));

            kafkaTemplate.send(record).get(10, TimeUnit.SECONDS);

            msg.setStatus("SENT");
            msg.setSentAt(Instant.now());
            outboxRepository.save(msg);
            log.info("Outbox message sent: id={}, topic={}", msg.getId(), topic);
        } catch (Exception e) {
            int newRetry = msg.getRetryCount() + 1;
            msg.setRetryCount(newRetry);
            if (newRetry >= msg.getMaxRetries()) {
                msg.setStatus("DEAD");
                log.error("Outbox message moved to DEAD letter: id={}, retryCount={}",
                        msg.getId(), newRetry);
            } else {
                msg.setStatus("PENDING");
                msg.setNextRetryAt(Instant.now().plusSeconds(newRetry * 30L));
                log.warn("Outbox message retry scheduled: id={}, retryCount={}, error={}",
                        msg.getId(), newRetry, e.getMessage());
            }
            outboxRepository.save(msg);
        }
    }

    @SuppressWarnings("unchecked")
    private String extractTraceId(String headersJson) {
        if (headersJson == null || headersJson.isBlank()) {
            return TraceContext.getOrCreate();
        }
        try {
            Map<String, String> headers = OBJECT_MAPPER.readValue(headersJson, Map.class);
            String traceId = headers.get(TraceContext.TRACE_ID_HEADER);
            return traceId != null ? traceId : TraceContext.getOrCreate();
        } catch (Exception e) {
            return TraceContext.getOrCreate();
        }
    }
}
