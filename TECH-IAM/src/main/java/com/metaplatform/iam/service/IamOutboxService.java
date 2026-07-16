package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.entity.IamOutboxEntity;
import com.metaplatform.iam.repository.IamOutboxRepository;
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

/**
 * IAM Outbox 服务（S-IAM-05 Kafka Outbox 基础版）。
 *
 * <p>遵循 Outbox 模式：业务事务中调用 {@link #publishEvent} 将事件写入
 * {@code iam_outbox_messages} 表（status=PENDING），后台 {@link #relay()} 定时
 * 轮询 PENDING 消息投递到 Kafka。</p>
 *
 * <ul>
 *   <li>Kafka Topic 规则：{@code metaplatform.{aggregate_type}.{event_type}}</li>
 *   <li>投递成功 status=SENT</li>
 *   <li>投递失败 retry_count++，超过 max_retries 则 status=FAILED</li>
 *   <li>Kafka 消息头包含 X-Trace-Id</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IamOutboxService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_SENT = "SENT";
    private static final String STATUS_FAILED = "FAILED";
    private static final String TOPIC_PREFIX = "metaplatform.";
    private static final String TRACE_ID_HEADER = "X-Trace-Id";

    private final IamOutboxRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 将事件写入 outbox 表（在调用方的业务事务内执行）。
     *
     * @param tenantId      租户 ID
     * @param aggregateType 聚合根类型（如 "User"）
     * @param aggregateId   聚合根 ID
     * @param eventType     事件类型（如 "USER_REGISTERED"）
     * @param payload       事件载荷（包含 userId、username、tenantId 等）
     * @param headers       消息头（至少包含 X-Trace-Id）
     */
    @Transactional
    public void publishEvent(
            String tenantId,
            String aggregateType,
            String aggregateId,
            String eventType,
            Map<String, Object> payload,
            Map<String, String> headers) {

        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            String headersJson = headers != null ? objectMapper.writeValueAsString(headers) : null;

            IamOutboxEntity entity = IamOutboxEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .aggregateType(aggregateType)
                    .aggregateId(aggregateId)
                    .eventType(eventType)
                    .payload(payloadJson)
                    .headers(headersJson)
                    .status(STATUS_PENDING)
                    .retryCount(0)
                    .maxRetries(3)
                    .build();

            outboxRepository.save(entity);
            log.debug("Outbox event saved: aggregateType={}, aggregateId={}, eventType={}",
                    aggregateType, aggregateId, eventType);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize outbox event", e);
        }
    }

    /**
     * 定时轮询 PENDING 消息投递到 Kafka（每 5 秒执行一次）。
     *
     * <p>投递成功 status=SENT；投递失败 retry_count++，超过 max_retries 则
     * status=FAILED。</p>
     */
    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void relay() {
        List<IamOutboxEntity> pending = outboxRepository.findByStatusOrderByCreatedAtAsc(STATUS_PENDING);
        if (pending.isEmpty()) {
            return;
        }

        log.debug("Relaying {} pending outbox messages", pending.size());

        for (IamOutboxEntity msg : pending) {
            try {
                String topic = TOPIC_PREFIX + msg.getAggregateType() + "." + msg.getEventType();

                ProducerRecord<String, String> record = new ProducerRecord<>(
                        topic, null, null, msg.getAggregateId(), msg.getPayload());

                // 从存储的 headers 中提取 traceId 并写入 Kafka 消息头
                String traceId = extractTraceId(msg.getHeaders());
                if (traceId != null) {
                    record.headers().add(TRACE_ID_HEADER, traceId.getBytes(StandardCharsets.UTF_8));
                }

                kafkaTemplate.send(record).get(10, java.util.concurrent.TimeUnit.SECONDS);

                msg.setStatus(STATUS_SENT);
                msg.setSentAt(Instant.now());
                outboxRepository.save(msg);

                log.debug("Outbox message sent: id={}, topic={}", msg.getId(), topic);
            } catch (Exception e) {
                log.warn("Failed to relay outbox message: id={}, error={}", msg.getId(), e.getMessage());
                msg.setRetryCount(msg.getRetryCount() + 1);
                if (msg.getRetryCount() >= msg.getMaxRetries()) {
                    msg.setStatus(STATUS_FAILED);
                } else {
                    msg.setNextRetryAt(Instant.now().plusSeconds(60));
                }
                outboxRepository.save(msg);
            }
        }
    }

    private String extractTraceId(String headersJson) {
        if (headersJson == null || headersJson.isBlank()) {
            return null;
        }
        try {
            Map<String, String> headers = objectMapper.readValue(headersJson, new TypeReference<>() {});
            return headers.get(TRACE_ID_HEADER);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse outbox headers: {}", e.getMessage());
            return null;
        }
    }
}
