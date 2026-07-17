package com.metaplatform.action.outbox.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.TraceContext;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.outbox.entity.OutboxMessageEntity;
import com.metaplatform.action.outbox.repository.OutboxMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActionOutboxService {

    private static final int RELAY_BATCH_SIZE = 100;
    private static final Duration SEND_TIMEOUT = Duration.ofSeconds(5);

    private final OutboxMessageRepository outboxMessageRepository;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Value("${action.outbox.relay-topic:metaplatform-action-events}")
    private String relayTopic;

    @Transactional
    public void publish(String tenantId, String aggregateId, String eventType, Object payload, String traceId) {
        String payloadJson = writePayload(payload);
        Instant now = Instant.now();
        OutboxMessageEntity message = OutboxMessageEntity.builder()
                .tenantId(tenantId)
                .aggregateId(aggregateId)
                .eventType(eventType)
                .payload(payloadJson)
                .status(OutboxMessageEntity.STATUS_PENDING)
                .retryCount(0)
                .maxRetries(OutboxMessageEntity.DEFAULT_MAX_RETRIES)
                .nextRetryAt(now)
                .traceId(traceId == null ? TraceContext.getOrCreate() : traceId)
                .createdAt(now)
                .build();
        outboxMessageRepository.save(message);
        log.debug("Outbox message enqueued: aggregateId={}, eventType={}, traceId={}",
                aggregateId, eventType, message.getTraceId());
    }

    public int relayOnce() {
        Instant now = Instant.now();
        List<OutboxMessageEntity> pending = outboxMessageRepository
                .findPendingForRelay(OutboxMessageEntity.STATUS_PENDING, now, PageRequest.of(0, RELAY_BATCH_SIZE));
        int processed = 0;
        for (OutboxMessageEntity message : pending) {
            processSingle(message, now);
            processed++;
        }
        return processed;
    }

    private void processSingle(OutboxMessageEntity message, Instant now) {
        try {
            ProducerRecord<String, String> record = new ProducerRecord<>(relayTopic, null,
                    message.getAggregateId(), message.getPayload());
            record.headers().add(ActionEventType.TRACE_ID_HEADER, utf8(message.getTraceId()));
            record.headers().add(ActionEventType.TENANT_ID_HEADER, utf8(message.getTenantId()));
            record.headers().add(ActionEventType.EVENT_TYPE_HEADER, utf8(message.getEventType()));
            kafkaTemplate.send(record).get(SEND_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);

            message.setStatus(OutboxMessageEntity.STATUS_SENT);
            message.setSentAt(now);
            outboxMessageRepository.save(message);
            log.debug("Outbox message sent: id={}, eventType={}", message.getId(), message.getEventType());
        } catch (Exception e) {
            handleSendFailure(message, now, e);
        }
    }

    private void handleSendFailure(OutboxMessageEntity message, Instant now, Exception e) {
        int newRetryCount = message.getRetryCount() + 1;
        message.setRetryCount(newRetryCount);
        message.setErrorMessage(truncate(e.getMessage()));
        if (newRetryCount >= message.getMaxRetries()) {
            message.setStatus(OutboxMessageEntity.STATUS_FAILED);
            log.error("Outbox message moved to DLQ after {} retries: id={}, aggregateId={}, traceId={}",
                    newRetryCount, message.getId(), message.getAggregateId(), message.getTraceId(), e);
        } else {
            long backoffSeconds = 5L * (1L << newRetryCount);
            message.setNextRetryAt(now.plusSeconds(backoffSeconds));
            log.warn("Outbox message send failed, will retry #{} in {}s: id={}",
                    newRetryCount, backoffSeconds, message.getId(), e);
        }
        outboxMessageRepository.save(message);
    }

    private String writePayload(Object payload) {
        if (payload == null) {
            return "{}";
        }
        if (payload instanceof String s) {
            return s;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new ActionException(ErrorCode.INVALID_PARAM, "outbox payload 序列化失败");
        }
    }

    private String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() > 1000 ? value.substring(0, 1000) : value;
    }

    private byte[] utf8(String value) {
        return value == null ? new byte[0] : value.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
}
