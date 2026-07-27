package com.metaplatform.msg.service;

import com.metaplatform.msg.common.ErrorCode;
import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.dto.CleanupResponse;
import com.metaplatform.msg.dto.RetryPolicyResponse;
import com.metaplatform.msg.entity.DlqMessageEntity;
import com.metaplatform.msg.entity.DlqRetryPolicyEntity;
import com.metaplatform.msg.repository.DlqMessageRepository;
import com.metaplatform.msg.repository.DlqRetryPolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DlqRetryPolicyService {

    private static final int DEFAULT_MAX_RETRIES = 3;
    private static final int DEFAULT_RETRY_INTERVAL_SECONDS = 60;
    private static final double DEFAULT_BACKOFF_MULTIPLIER = 2.0;
    private static final int DEFAULT_AUTO_CLEANUP_DAYS = 30;

    private final DlqRetryPolicyRepository retryPolicyRepository;
    private final DlqMessageRepository dlqMessageRepository;

    @Transactional
    public RetryPolicyResponse createOrUpdate(String tenantId, String topic, Integer maxRetries,
                                               Integer retryIntervalSeconds, Double backoffMultiplier,
                                               Integer autoCleanupDays) {
        String effectiveTenantId = resolveTenantId(tenantId);

        Optional<DlqRetryPolicyEntity> existing = retryPolicyRepository
                .findByTenantIdAndTopic(effectiveTenantId, topic);

        DlqRetryPolicyEntity entity;
        if (existing.isPresent()) {
            entity = existing.get();
            log.info("Updating existing DLQ retry policy: id={}, topic={}", entity.getId(), topic);
        } else {
            entity = DlqRetryPolicyEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(effectiveTenantId)
                    .topic(topic)
                    .build();
            log.info("Creating new DLQ retry policy for topic={}", topic);
        }

        if (maxRetries != null) entity.setMaxRetries(maxRetries);
        if (retryIntervalSeconds != null) entity.setRetryIntervalSeconds(retryIntervalSeconds);
        if (backoffMultiplier != null) entity.setRetryBackoffMultiplier(backoffMultiplier);
        if (autoCleanupDays != null) entity.setAutoCleanupDays(autoCleanupDays);

        entity = retryPolicyRepository.save(entity);
        return RetryPolicyResponse.from(entity);
    }

    public RetryPolicyResponse getByTopic(String tenantId, String topic) {
        String effectiveTenantId = resolveTenantId(tenantId);
        DlqRetryPolicyEntity entity = retryPolicyRepository
                .findByTenantIdAndTopic(effectiveTenantId, topic)
                .orElseThrow(() -> new MsgException(ErrorCode.DLQ_POLICY_NOT_FOUND,
                        "DLQ 重试策略不存在: topic=" + topic));
        return RetryPolicyResponse.from(entity);
    }

    public List<RetryPolicyResponse> list(String tenantId) {
        String effectiveTenantId = resolveTenantId(tenantId);
        return retryPolicyRepository.findByTenantId(effectiveTenantId).stream()
                .map(RetryPolicyResponse::from)
                .toList();
    }

    @Transactional
    public void delete(String id) {
        DlqRetryPolicyEntity entity = retryPolicyRepository.findById(id)
                .orElseThrow(() -> new MsgException(ErrorCode.DLQ_POLICY_NOT_FOUND,
                        "DLQ 重试策略不存在: " + id));
        retryPolicyRepository.delete(entity);
        log.info("DLQ retry policy deleted: id={}, topic={}", id, entity.getTopic());
    }

    @Transactional
    public Instant applyRetry(String messageId) {
        DlqMessageEntity message = dlqMessageRepository.findById(messageId)
                .orElseThrow(() -> new MsgException(ErrorCode.DLQ_MESSAGE_NOT_FOUND,
                        "DLQ 消息不存在: " + messageId));

        DlqRetryPolicyEntity policy = retryPolicyRepository
                .findByTenantIdAndTopic(message.getTenantId(), message.getOriginalTopic())
                .orElse(null);

        int interval = policy != null ? policy.getRetryIntervalSeconds() : DEFAULT_RETRY_INTERVAL_SECONDS;
        double multiplier = policy != null ? policy.getRetryBackoffMultiplier() : DEFAULT_BACKOFF_MULTIPLIER;
        int retryCount = message.getRetryCount();

        long delaySeconds = (long) (interval * Math.pow(multiplier, retryCount));
        Instant nextRetryAt = Instant.now().plusSeconds(delaySeconds);

        message.setNextRetryAt(nextRetryAt);
        dlqMessageRepository.save(message);

        log.info("DLQ retry applied: messageId={}, nextRetryAt={}, delaySeconds={}",
                messageId, nextRetryAt, delaySeconds);
        return nextRetryAt;
    }

    @Transactional
    public CleanupResponse cleanupExpired(String tenantId) {
        String effectiveTenantId = resolveTenantId(tenantId);

        List<DlqRetryPolicyEntity> policies = retryPolicyRepository.findByTenantId(effectiveTenantId);
        Map<String, Integer> topicCleanupDays = new HashMap<>();
        for (DlqRetryPolicyEntity policy : policies) {
            topicCleanupDays.put(policy.getTopic(), policy.getAutoCleanupDays());
        }

        List<DlqMessageEntity> processedMessages = dlqMessageRepository
                .findByTenantIdAndStatusIn(effectiveTenantId,
                        List.of(DlqMessageEntity.DlqStatus.RESENT, DlqMessageEntity.DlqStatus.DEAD));

        Instant now = Instant.now();
        List<String> toDelete = new ArrayList<>();

        for (DlqMessageEntity message : processedMessages) {
            int cleanupDays = topicCleanupDays.getOrDefault(message.getOriginalTopic(), DEFAULT_AUTO_CLEANUP_DAYS);
            Instant cutoff = now.minus(cleanupDays, ChronoUnit.DAYS);
            if (message.getUpdatedAt() != null && message.getUpdatedAt().isBefore(cutoff)) {
                toDelete.add(message.getId());
            }
        }

        int deletedCount = 0;
        if (!toDelete.isEmpty()) {
            deletedCount = dlqMessageRepository.deleteByIds(toDelete);
        }

        log.info("DLQ cleanup completed: tenantId={}, deletedCount={}", effectiveTenantId, deletedCount);

        return CleanupResponse.builder()
                .tenantId(effectiveTenantId)
                .deletedCount(deletedCount)
                .message("清理完成，删除了 " + deletedCount + " 条过期消息")
                .build();
    }

    private String resolveTenantId(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            return "tenant-default";
        }
        return tenantId;
    }
}
