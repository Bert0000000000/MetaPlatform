package com.metaplatform.obs.anomaly.service;

import com.metaplatform.obs.anomaly.dto.RootCauseAnalysisResult;
import com.metaplatform.obs.anomaly.entity.AnomalyEventEntity;
import com.metaplatform.obs.dto.LogEntry;
import com.metaplatform.obs.entity.ObsLogEntity;
import com.metaplatform.obs.repository.ObsLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RootCauseAnalysisService {

    private static final int MAX_RELATED_LOGS = 20;

    private final ObsLogRepository obsLogRepository;

    public RootCauseAnalysisResult analyze(AnomalyEventEntity event) {
        String traceId = event.getTraceId();
        List<ObsLogEntity> rawLogs;
        if (traceId != null && !traceId.isBlank()) {
            rawLogs = obsLogRepository.findByTraceId(traceId, MAX_RELATED_LOGS);
        } else {
            rawLogs = List.of();
        }

        List<LogEntry> relatedLogs = rawLogs.stream()
                .map(this::toLogEntry)
                .toList();

        Map<String, Double> relatedMetrics = buildRelatedMetrics(event);

        String conclusion = mockLlmConclusion(event, relatedLogs);
        String suggestedAction = suggestAction(event.getAnomalyType());

        return RootCauseAnalysisResult.builder()
                .conclusion(conclusion)
                .suggestedAction(suggestedAction)
                .relatedLogs(relatedLogs)
                .relatedMetrics(relatedMetrics)
                .build();
    }

    private LogEntry toLogEntry(ObsLogEntity entity) {
        return LogEntry.builder()
                .timestamp(entity.getCreatedAt())
                .serviceName(entity.getServiceName())
                .level(entity.getLevel())
                .traceId(entity.getTraceId())
                .message(entity.getMessage())
                .build();
    }

    private Map<String, Double> buildRelatedMetrics(AnomalyEventEntity event) {
        Map<String, Double> metrics = new HashMap<>();
        metrics.put("currentValue", event.getMetricValue());
        metrics.put("threshold", 0.0);
        metrics.put("impactScore", severityScore(event.getSeverity()) * event.getMetricValue());
        return metrics;
    }

    private double severityScore(String severity) {
        return switch (severity != null ? severity.toUpperCase() : "WARNING") {
            case "CRITICAL" -> 1.5;
            case "WARNING" -> 1.0;
            case "INFO" -> 0.5;
            default -> 1.0;
        };
    }

    private String mockLlmConclusion(AnomalyEventEntity event, List<LogEntry> logs) {
        String type = event.getAnomalyType() != null ? event.getAnomalyType().toUpperCase() : "UNKNOWN";
        int errorCount = (int) logs.stream().filter(l -> "ERROR".equalsIgnoreCase(l.getLevel())).count();
        return switch (type) {
            case "ERROR_RATE" -> String.format(
                    "服务 %s 错误率异常（%.2f%%），关联日志中 ERROR 级别 %d 条，疑似下游依赖超时或实例不健康。",
                    event.getServiceName(), event.getMetricValue(), errorCount);
            case "P99_LATENCY" -> String.format(
                    "服务 %s P99 延迟达到 %.2f ms，超过基线，可能因 GC、缓存击穿或依赖服务响应变慢导致。",
                    event.getServiceName(), event.getMetricValue());
            case "ERROR_CODE" -> String.format(
                    "服务 %s 特定错误码出现 %.0f 次，结合 trace 日志判断为配置变更或接口契约不一致。",
                    event.getServiceName(), event.getMetricValue());
            default -> String.format("服务 %s 检测到 %s 异常，当前值 %.2f，建议进一步排查。",
                    event.getServiceName(), type, event.getMetricValue());
        };
    }

    private String suggestAction(String anomalyType) {
        return switch (anomalyType != null ? anomalyType.toUpperCase() : "UNKNOWN") {
            case "ERROR_RATE" -> "serviceRestart";
            case "P99_LATENCY" -> "cacheClear";
            case "ERROR_CODE" -> "configRollback";
            default -> "serviceRestart";
        };
    }
}
