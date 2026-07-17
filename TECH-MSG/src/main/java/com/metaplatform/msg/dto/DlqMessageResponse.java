package com.metaplatform.msg.dto;

import com.metaplatform.msg.entity.DlqMessageEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DlqMessageResponse {

    private String id;
    private String tenantId;
    private String originalTopic;
    private String originalMessageKey;
    private String payload;
    private String headers;
    private String errorMessage;
    private String errorClass;
    private Integer retryCount;
    private String status;
    private Instant nextRetryAt;
    private Instant firstFailedAt;
    private Instant lastFailedAt;
    private Instant createdAt;
    private Instant updatedAt;

    public static DlqMessageResponse from(DlqMessageEntity e) {
        return DlqMessageResponse.builder()
                .id(e.getId())
                .tenantId(e.getTenantId())
                .originalTopic(e.getOriginalTopic())
                .originalMessageKey(e.getOriginalMessageKey())
                .payload(e.getPayload())
                .headers(e.getHeaders())
                .errorMessage(e.getErrorMessage())
                .errorClass(e.getErrorClass())
                .retryCount(e.getRetryCount())
                .status(e.getStatus().name())
                .nextRetryAt(e.getNextRetryAt())
                .firstFailedAt(e.getFirstFailedAt())
                .lastFailedAt(e.getLastFailedAt())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
