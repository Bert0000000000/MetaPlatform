package com.metaplatform.msg.service;

import com.metaplatform.msg.entity.OutboxMessageEntity;
import com.metaplatform.msg.repository.OutboxMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutboxRelayService {

    @Value("${app.msg.outbox.batch-size:100}")
    private int batchSize;

    @Value("${app.msg.outbox.max-retries:3}")
    private int maxRetries;

    @Value("${app.msg.outbox.backoff-initial-ms:1000}")
    private long backoffInitialMs;

    @Value("${app.msg.outbox.backoff-max-ms:60000}")
    private long backoffMaxMs;

    @Value("${app.msg.outbox.backoff-multiplier:2.0}")
    private double backoffMultiplier;

    private final OutboxMessageRepository outboxRepository;
    private final KafkaPublisherService kafkaPublisherService;

    @Scheduled(fixedDelayString = "${app.msg.outbox.poll-interval-ms:5000}")
    public void relayMessages() {
        List<OutboxMessageEntity> pendingMessages = outboxRepository.findPendingForRelay(
                OutboxMessageEntity.OutboxStatus.PENDING,
                Instant.now(),
                PageRequest.of(0, batchSize));

        if (pendingMessages.isEmpty()) {
            return;
        }

        log.info("Outbox relay processing {} pending messages", pendingMessages.size());

        for (OutboxMessageEntity message : pendingMessages) {
            try {
                relaySingleMessage(message);
            } catch (Exception e) {
                log.error("Unexpected error relaying outbox message id={}, traceId={}",
                        message.getId(), getTraceId(message), e);
            }
        }
    }

    @Transactional
    public void relaySingleMessage(OutboxMessageEntity message) {
        String topic = buildTopicName(message);
        String key = message.getAggregateId();

        try {
            kafkaPublisherService.publish(topic, key, message.getPayload(), message.getHeaders());

            message.setStatus(OutboxMessageEntity.OutboxStatus.SENT);
            message.setSentAt(Instant.now());
            outboxRepository.save(message);

            log.info("Outbox message sent: id={}, topic={}, traceId={}",
                    message.getId(), topic, getTraceId(message));
        } catch (Exception e) {
            log.error("Outbox message delivery failed: id={}, topic={}, traceId={}, error={}",
                    message.getId(), topic, getTraceId(message), e.getMessage());

            int newRetryCount = message.getRetryCount() + 1;
            message.setRetryCount(newRetryCount);

            int effectiveMaxRetries = message.getMaxRetries() != null ? message.getMaxRetries() : maxRetries;

            if (newRetryCount >= effectiveMaxRetries) {
                message.setStatus(OutboxMessageEntity.OutboxStatus.FAILED);
                sendToDlq(message, topic, e);
                log.warn("Outbox message moved to DLQ after {} retries: id={}, traceId={}",
                        newRetryCount, message.getId(), getTraceId(message));
            } else {
                message.setNextRetryAt(calculateNextRetry(newRetryCount));
            }
            outboxRepository.save(message);
        }
    }

    @Transactional
    public boolean manualRetry(String outboxId) {
        OutboxMessageEntity message = outboxRepository.findById(outboxId)
                .orElseThrow(() -> new com.metaplatform.msg.common.MsgException(
                        com.metaplatform.msg.common.ErrorCode.OUTBOX_NOT_FOUND,
                        "Outbox 消息不存在: " + outboxId));

        if (message.getStatus() == OutboxMessageEntity.OutboxStatus.SENT) {
            throw new com.metaplatform.msg.common.MsgException(
                    com.metaplatform.msg.common.ErrorCode.STATE_CONFLICT,
                    "已投递的消息不能重试");
        }

        message.setStatus(OutboxMessageEntity.OutboxStatus.PENDING);
        message.setRetryCount(0);
        message.setNextRetryAt(Instant.now());
        outboxRepository.save(message);

        log.info("Outbox message manually retried: id={}, traceId={}", outboxId, getTraceId(message));
        return true;
    }

    private void sendToDlq(OutboxMessageEntity message, String originalTopic, Exception error) {
        try {
            kafkaPublisherService.publishToDlq(originalTopic, message.getAggregateId(),
                    message.getPayload(), message.getHeaders());
        } catch (Exception dlqError) {
            log.error("Failed to send outbox message to DLQ: id={}, traceId={}, error={}",
                    message.getId(), getTraceId(message), dlqError.getMessage());
        }
    }

    private String buildTopicName(OutboxMessageEntity message) {
        return "metaplatform." + message.getAggregateType() + "." + message.getEventType();
    }

    private Instant calculateNextRetry(int retryCount) {
        long delayMs = (long) (backoffInitialMs * Math.pow(backoffMultiplier, retryCount - 1));
        delayMs = Math.min(delayMs, backoffMaxMs);
        return Instant.now().plusMillis(delayMs);
    }

    private String getTraceId(OutboxMessageEntity message) {
        if (message.getHeaders() != null) {
            Object traceId = message.getHeaders().get("X-Trace-Id");
            if (traceId != null) {
                return traceId.toString();
            }
            Object lowerTraceId = message.getHeaders().get("traceId");
            if (lowerTraceId != null) {
                return lowerTraceId.toString();
            }
        }
        return "unknown";
    }
}
