package com.metaplatform.iam.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogStatisticsResponse {

    private long total;
    private Map<String, Long> byAction;
    private Map<String, Long> byStatus;
}
