package com.metaplatform.msg.dto;

import com.metaplatform.msg.entity.OutboxMessageEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxResponse {

    private String id;
    private String tenantId;
    private String aggregateType;
    private String aggregateId;
    private String eventType;
    private Map<String, Object> payload;
    private Map<String, Object> headers;
    private String status;
    private Integer retryCount;
    private Integer maxRetries;
    private Instant nextRetryAt;
    private Instant createdAt;
    private Instant sentAt;

    public static OutboxResponse from(OutboxMessageEntity e) {
        return OutboxResponse.builder()
                .id(e.getId())
                .tenantId(e.getTenantId())
                .aggregateType(e.getAggregateType())
                .aggregateId(e.getAggregateId())
                .eventType(e.getEventType())
                .payload(e.getPayload())
                .headers(e.getHeaders())
                .status(e.getStatus().name())
                .retryCount(e.getRetryCount())
                .maxRetries(e.getMaxRetries())
                .nextRetryAt(e.getNextRetryAt())
                .createdAt(e.getCreatedAt())
                .sentAt(e.getSentAt())
                .build();
    }
}
