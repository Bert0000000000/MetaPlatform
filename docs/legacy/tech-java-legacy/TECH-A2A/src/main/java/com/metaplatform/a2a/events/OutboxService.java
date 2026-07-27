package com.metaplatform.a2a.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.common.TenantContext;
import com.metaplatform.a2a.entity.OutboxEventEntity;
import com.metaplatform.a2a.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Outbox 事件服务。
 *
 * <p>对应 Python {@code app.events.outbox.OutboxService}。
 * 采用「事务内写入 outbox_event 表 + 事务提交后 Kafka 发送」的两阶段模式，
 * 保证消息发布与数据库事务的最终一致性。</p>
 *
 * <p>核心流程：
 * <ol>
 *   <li>{@link #recordEvent} 在业务事务内写入 outbox_event 表</li>
 *   <li>事务提交后，通过 {@link TransactionSynchronization} 触发 Kafka 发送</li>
 *   <li>定时任务兜底，重新发送未中继的事件（relayed=false）</li>
 * </ol></p>
 */
@Slf4j
@Service
public class OutboxService {

    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String kafkaTopic;

    public OutboxService(OutboxEventRepository outboxRepository,
                         ObjectMapper objectMapper,
                         @Autowired(required = false) KafkaTemplate<String, Object> kafkaTemplate,
                         @Value("${mate.a2a.kafka-topic:a2a-protocol-events}") String kafkaTopic) {
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
        this.kafkaTemplate = kafkaTemplate;
        this.kafkaTopic = kafkaTopic;
    }

    /**
     * 在当前事务内记录事件到 outbox 表。
     *
     * <p>事务提交后由 {@link TransactionSynchronization#afterCommit()} 触发 Kafka 发送。
     * 若当前无活动事务，则立即发送（用于测试场景）。</p>
     *
     * @param type    事件类型
     * @param payload 事件负载（会被序列化为 JSON）
     */
    public void recordEvent(EventType type, Map<String, Object> payload) {
        String traceId = TenantContext.getTraceId();
        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            log.error("Outbox 事件序列化失败 | type={}", type, ex);
            return;
        }

        OutboxEventEntity entity = new OutboxEventEntity();
        entity.setEventId(UUID.randomUUID().toString().replace("-", ""));
        entity.setEventType(type.getCode());
        entity.setPayload(payloadJson);
        entity.setTraceId(traceId);
        entity.setRelayed(false);

        outboxRepository.save(entity);

        // 事务提交后触发 Kafka 发送
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            sendToKafka(entity);
                        }
                    });
        } else {
            // 无活动事务，立即发送
            sendToKafka(entity);
        }
    }

    /**
     * 定时重发未中继事件（每 30 秒一次，兜底机制）。
     */
    @Scheduled(fixedDelay = 30_000L, initialDelay = 30_000L)
    @Transactional
    public void relayPendingEvents() {
        List<OutboxEventEntity> pending = outboxRepository.findByRelayedFalse();
        if (pending.isEmpty()) {
            return;
        }
        log.info("Outbox 兜底重发 | count={}", pending.size());
        for (OutboxEventEntity event : pending) {
            sendToKafka(event);
        }
    }

    /**
     * 发送单个事件到 Kafka 并标记已中继。
     */
    @Transactional
    public void sendToKafka(OutboxEventEntity event) {
        if (kafkaTemplate == null) {
            log.warn("KafkaTemplate 未配置，跳过发送 | eventId={} type={}",
                    event.getEventId(), event.getEventType());
            markRelayed(event.getEventId());
            return;
        }

        try {
            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("eventId", event.getEventId());
            envelope.put("eventType", event.getEventType());
            envelope.put("payload",
                    objectMapper.readValue(event.getPayload(), Map.class));
            if (event.getTraceId() != null) {
                envelope.put("traceId", event.getTraceId());
            }

            kafkaTemplate.send(kafkaTopic, event.getEventId(), envelope);
            markRelayed(event.getEventId());
            log.debug("Outbox 事件已发送 | eventId={} type={}",
                    event.getEventId(), event.getEventType());
        } catch (Exception ex) {
            log.error("Outbox 事件发送失败 | eventId={} type={}",
                    event.getEventId(), event.getEventType(), ex);
        }
    }

    private void markRelayed(String eventId) {
        outboxRepository.markRelayed(eventId, OffsetDateTime.now());
    }
}
