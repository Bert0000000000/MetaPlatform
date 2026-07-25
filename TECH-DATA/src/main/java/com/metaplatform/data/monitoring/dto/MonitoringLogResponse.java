package com.metaplatform.data.monitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 监控日志响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonitoringLogResponse {

    private String logId;
    private String component;
    private String level;
    private String message;
    private Map<String, Object> context;
    private OffsetDateTime timestamp;
}
