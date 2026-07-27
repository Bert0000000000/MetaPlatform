package com.metaplatform.msg.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.msg.common.ErrorCode;
import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.BatchResendResponse;
import com.metaplatform.msg.dto.DlqMessageResponse;
import com.metaplatform.msg.entity.DlqMessageEntity;
import com.metaplatform.msg.entity.DlqRetryPolicyEntity;
import com.metaplatform.msg.repository.DlqMessageRepository;
import com.metaplatform.msg.repository.DlqRetryPolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DlqMessageService {

    private static final int DEFAULT_MAX_RETRIES = 3;
    private static final int DEFAULT_RETRY_INTERVAL_SECONDS = 60;
    private static final double DEFAULT_BACKOFF_MULTIPLIER = 2.0;

    private final DlqMessageRepository dlqMessageRepository;
    private final DlqRetryPolicyRepository dlqRetryPolicyRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PageResponse<DlqMessageResponse> list(String tenantId, String topic, String status, int page, int size) {
        String effectiveTenantId = resolveTenantId(tenantId);
        DlqMessageEntity.DlqStatus dlqStatus = parseStatus(status);

        Pageable pageable = PageRequest.of(page - 1, size);
        Page<DlqMessageEntity> entityPage = dlqMessageRepository.findByFilters(
                effectiveTenantId, topic, dlqStatus, pageable);

        List<DlqMessageResponse> items = entityPage.getContent().stream()
                .map(DlqMessageResponse::from)
                .toList();

        return PageResponse.<DlqMessageResponse>builder()
                .items(items)
                .total(entityPage.getTotalElements())
                .page(page)
                .size(size)
                .totalPages(entityPage.getTotalPages())
                .build();
    }

    public DlqMessageResponse getById(String id) {
        DlqMessageEntity entity = findById(id);
        return DlqMessageResponse.from(entity);
    }

    @Transactional
    public DlqMessageResponse resend(String id) {
        DlqMessageEntity message = findById(id);

        if (message.getStatus() == DlqMessageEntity.DlqStatus.DEAD) {
            throw new MsgException(ErrorCode.STATE_CONFLICT,
                    "已标记为 DEAD 的消息不能重发: " + id);
        }

        DlqRetryPolicyEntity policy = dlqRetryPolicyRepository
                .findByTenantIdAndTopic(message.getTenantId(), message.getOriginalTopic())
                .orElse(null);

        int maxRetries = policy != null ? policy.getMaxRetries() : DEFAULT_MAX_RETRIES;
        int retryInterval = policy != null ? policy.getRetryIntervalSeconds() : DEFAULT_RETRY_INTERVAL_SECONDS;
        double backoffMultiplier = policy != null ? policy.getRetryBackoffMultiplier() : DEFAULT_BACKOFF_MULTIPLIER;

        if (message.getRetryCount() >= maxRetries) {
            message.setStatus(DlqMessageEntity.DlqStatus.DEAD);
            dlqMessageRepository.save(message);
            log.warn("DLQ message marked as DEAD (max retries exceeded): id={}, retryCount={}, maxRetries={}",
                    id, message.getRetryCount(), maxRetries);
            return DlqMessageResponse.from(message);
        }

        message.setStatus(DlqMessageEntity.DlqStatus.RESENDING);
        dlqMessageRepository.save(message);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payloadMap = objectMapper.readValue(message.getPayload(), Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> headersMap = message.getHeaders() != null
                    ? objectMapper.readValue(message.getHeaders(), Map.class)
                    : new HashMap<>();

            List<Header> kafkaHeaders = buildKafkaHeaders(headersMap);
            ProducerRecord<String, Object> record = new ProducerRecord<>(
                    message.getOriginalTopic(), null, message.getOriginalMessageKey(),
                    payloadMap, kafkaHeaders);

            kafkaTemplate.send(record).get();

            message.setStatus(DlqMessageEntity.DlqStatus.RESENT);
            dlqMessageRepository.save(message);
            log.info("DLQ message resent successfully: id={}, topic={}", id, message.getOriginalTopic());

        } catch (Exception e) {
            Throwable cause = e;
            if (e instanceof java.util.concurrent.ExecutionException && e.getCause() != null) {
                cause = e.getCause();
            }

            int newRetryCount = message.getRetryCount() + 1;
            message.setRetryCount(newRetryCount);
            message.setLastFailedAt(Instant.now());

            if (newRetryCount >= maxRetries) {
                message.setStatus(DlqMessageEntity.DlqStatus.DEAD);
            } else {
                message.setStatus(DlqMessageEntity.DlqStatus.PENDING);
                long delaySeconds = (long) (retryInterval * Math.pow(backoffMultiplier, newRetryCount));
                message.setNextRetryAt(Instant.now().plusSeconds(delaySeconds));
            }

            dlqMessageRepository.save(message);
            log.error("DLQ message resend failed: id={}, error={}", id, cause.getMessage());
        }

        return DlqMessageResponse.from(message);
    }

    public BatchResendResponse batchResend(List<String> ids) {
        int successCount = 0;
        int failedCount = 0;
        List<Map<String, String>> results = new ArrayList<>();

        for (String id : ids) {
            try {
                DlqMessageResponse response = resend(id);
                String status = response.getStatus();
                Map<String, String> result = new LinkedHashMap<>();
                result.put("id", id);
                result.put("status", status);
                if ("RESENT".equals(status)) {
                    successCount++;
                } else {
                    failedCount++;
                }
                results.add(result);
            } catch (Exception e) {
                Map<String, String> result = new LinkedHashMap<>();
                result.put("id", id);
                result.put("status", "ERROR");
                result.put("error", e.getMessage());
                results.add(result);
                failedCount++;
            }
        }

        return BatchResendResponse.builder()
                .successCount(successCount)
                .failedCount(failedCount)
                .results(results)
                .build();
    }

    private DlqMessageEntity findById(String id) {
        return dlqMessageRepository.findById(id)
                .orElseThrow(() -> new MsgException(ErrorCode.DLQ_MESSAGE_NOT_FOUND,
                        "DLQ 消息不存在: " + id));
    }

    private DlqMessageEntity.DlqStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return DlqMessageEntity.DlqStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new MsgException(ErrorCode.INVALID_PARAM, "无效的状态值: " + status);
        }
    }

    private List<Header> buildKafkaHeaders(Map<String, Object> headers) {
        List<Header> headerList = new ArrayList<>();
        if (headers != null) {
            for (Map.Entry<String, Object> entry : headers.entrySet()) {
                if (entry.getValue() != null) {
                    headerList.add(new RecordHeader(entry.getKey(),
                            String.valueOf(entry.getValue()).getBytes(StandardCharsets.UTF_8)));
                }
            }
        }
        return headerList;
    }

    private String resolveTenantId(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            return "tenant-default";
        }
        return tenantId;
    }
}
