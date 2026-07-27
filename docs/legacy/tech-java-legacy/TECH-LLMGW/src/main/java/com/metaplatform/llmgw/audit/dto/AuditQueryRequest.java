package com.metaplatform.llmgw.audit.dto;

import java.time.LocalDateTime;

public record AuditQueryRequest(
        String userId,
        String modelId,
        LocalDateTime startTime,
        LocalDateTime endTime,
        Integer page,
        Integer size
) {
}
