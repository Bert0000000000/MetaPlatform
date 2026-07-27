package com.metaplatform.mcp.audit.processor;

import com.metaplatform.mcp.audit.entity.McpOutboxEntity;
import com.metaplatform.mcp.audit.repository.McpOutboxRepository;
import com.metaplatform.mcp.common.TraceContext;
import com.metaplatform.mcp.config.McpAuditProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Outbox 模式处理器：每 10 秒扫描 PENDING 状态的 mcp_outbox，
 * 通过 KafkaTemplate 投递到 audit topic。
 * 失败 → retry_count++，超过 3 次标记 DEAD。
 * KafkaTemplate 通过 ObjectProvider 注入（Kafka 未启用时不创建 Bean）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class McpOutboxProcessor {

    private static final int MAX_RETRY = 3;
    private static final Duration RETRY_BACKOFF = Duration.ofSeconds(30);

    private final McpOutboxRepository outboxRepository;
    private final McpAuditProperties auditProperties;
    private final ObjectProvider<KafkaTemplate<String, String>> kafkaTemplateProvider;

    @Scheduled(fixedRateString = "10000")
    public void dispatch() {
        if (!auditProperties.isKafkaOutboxEnabled()) {
            return;
        }
        KafkaTemplate<String, String> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate == null) {
            log.debug("KafkaTemplate not available, skip outbox dispatch");
            return;
        }
        List<McpOutboxEntity> pending = outboxRepository
                .findTop100ByStatusOrderByCreatedAtAsc("PENDING");
        if (pending.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        for (McpOutboxEntity outbox : pending) {
            try {
                if (outbox.getNextRetryAt() != null && now.isBefore(outbox.getNextRetryAt())) {
                    continue;
                }
                String previousTraceId = TraceContext.get();
                try {
                    TraceContext.set(outbox.getTraceId());
                    kafkaTemplate.send(auditProperties.getOutboxTopic(),
                            outbox.getTenantId(),
                            outbox.getPayload() == null ? "{}" : outbox.getPayload());
                    outbox.setStatus("SENT");
                    outbox.setLastErrorMessage(null);
                    outbox.setUpdatedAt(Instant.now());
                    outboxRepository.save(outbox);
                } finally {
                    if (previousTraceId != null) {
                        TraceContext.set(previousTraceId);
                    } else {
                        TraceContext.clear();
                    }
                }
            } catch (Exception e) {
                int retryCount = (outbox.getRetryCount() == null ? 0 : outbox.getRetryCount()) + 1;
                outbox.setRetryCount(retryCount);
                outbox.setLastErrorMessage(e.getMessage());
                outbox.setUpdatedAt(Instant.now());
                if (retryCount >= MAX_RETRY) {
                    outbox.setStatus("DEAD");
                    log.error("Outbox dispatch dead-letter, id={}, retries={}",
                            outbox.getId(), retryCount);
                } else {
                    outbox.setNextRetryAt(Instant.now().plus(RETRY_BACKOFF.multipliedBy(retryCount)));
                    log.warn("Outbox dispatch failed, id={}, retry={}, err={}",
                            outbox.getId(), retryCount, e.getMessage());
                }
                outboxRepository.save(outbox);
            }
        }
    }
}