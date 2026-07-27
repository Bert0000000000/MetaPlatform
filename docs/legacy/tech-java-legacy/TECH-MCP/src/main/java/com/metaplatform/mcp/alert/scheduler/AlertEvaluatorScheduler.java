package com.metaplatform.mcp.alert.scheduler;

import com.metaplatform.mcp.alert.entity.McpAlertRuleEntity;
import com.metaplatform.mcp.alert.notification.AlertNotificationSender;
import com.metaplatform.mcp.alert.repository.McpAlertRuleRepository;
import com.metaplatform.mcp.audit.repository.McpAuditLogRepository;
import com.metaplatform.mcp.config.McpAlertProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 告警规则评估器：周期性扫描 enabled=true 的规则，
 * 命中阈值后通过 AlertNotificationSender 异步发送告警事件。
 * 内置 metric 类型：
 *  - TOOL_FAILURE_RATE : (FAILURE count in window) / (total count in window) > threshold
 *  - TOOL_DURATION_P95 : 最近 windowMinutes 内 FAILURE 或 SUCCESS 记录 AVG(durationMs) > threshold (ms)
 *  - TOOL_CALL_COUNT   : windowMinutes 内 toolCode 出现次数 > threshold
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertEvaluatorScheduler {

    private static final String METRIC_FAILURE_RATE = "TOOL_FAILURE_RATE";
    private static final String METRIC_DURATION_AVG = "TOOL_DURATION_AVG";
    private static final String METRIC_CALL_COUNT = "TOOL_CALL_COUNT";

    private final McpAlertRuleRepository alertRuleRepository;
    private final McpAuditLogRepository auditLogRepository;
    private final McpAlertProperties alertProperties;
    private final AlertNotificationSender notificationSender;

    @Scheduled(fixedRateString = "#{@mcpAlertProperties.scanIntervalMs}",
            initialDelayString = "30000")
    public void evaluate() {
        if (!alertProperties.isEnabled()) {
            return;
        }
        try {
            List<McpAlertRuleEntity> rules = alertRuleRepository.findAll().stream()
                    .filter(r -> Boolean.TRUE.equals(r.getEnabled()))
                    .toList();
            if (rules.isEmpty()) {
                return;
            }
            int fired = 0;
            for (McpAlertRuleEntity rule : rules) {
                if (evaluateOne(rule)) {
                    fired++;
                }
            }
            if (fired > 0) {
                log.info("AlertEvaluatorScheduler fired alerts, count={}", fired);
            }
        } catch (Exception e) {
            log.warn("AlertEvaluatorScheduler evaluate failed", e);
        }
    }

    private boolean evaluateOne(McpAlertRuleEntity rule) {
        Instant now = Instant.now();
        Instant windowStart = now.minus(Duration.ofMinutes(rule.getWindowMinutes() == null ? 5 : rule.getWindowMinutes()));
        String metric = rule.getMetric() == null ? "" : rule.getMetric().toUpperCase();
        BigDecimal threshold = rule.getThreshold() == null ? BigDecimal.ZERO : rule.getThreshold();

        try {
            double observed = switch (metric) {
                case METRIC_FAILURE_RATE -> failureRate(rule, windowStart, now);
                case METRIC_DURATION_AVG -> avgDuration(rule, windowStart, now);
                case METRIC_CALL_COUNT -> callCount(rule, windowStart, now);
                default -> {
                    log.debug("unsupported metric, ruleId={}, metric={}", rule.getId(), metric);
                    yield Double.NaN;
                }
            };

            if (Double.isNaN(observed)) {
                return false;
            }
            if (BigDecimal.valueOf(observed).compareTo(threshold) > 0) {
                notificationSender.send(Map.of(
                        "ruleId", rule.getId().toString(),
                        "tenantId", rule.getTenantId(),
                        "name", rule.getName(),
                        "metric", metric,
                        "threshold", threshold,
                        "observed", observed,
                        "windowMinutes", rule.getWindowMinutes(),
                        "firedAt", now.toString(),
                        "notifyChannels", rule.getNotifyChannels() == null ? "" : rule.getNotifyChannels()
                ));
                return true;
            }
            return false;
        } catch (Exception e) {
            log.warn("evaluateOne failed, ruleId={}, err={}", rule.getId(), e.getMessage());
            return false;
        }
    }

    private double failureRate(McpAlertRuleEntity rule, Instant from, Instant to) {
        Object[] aggregate = auditLogRepository.aggregate(rule.getTenantId(), from, to);
        if (aggregate == null || aggregate.length < 1 || aggregate[0] == null) {
            return 0d;
        }
        Number total = (Number) aggregate[0];
        Number errors = auditLogRepository.findRecentErrors(rule.getTenantId(), from,
                org.springframework.data.domain.PageRequest.of(0, 1000)).size();
        if (total.longValue() == 0) {
            return 0d;
        }
        return errors.doubleValue() / total.doubleValue();
    }

    private double avgDuration(McpAlertRuleEntity rule, Instant from, Instant to) {
        Object[] aggregate = auditLogRepository.aggregate(rule.getTenantId(), from, to);
        if (aggregate == null || aggregate.length < 3 || aggregate[2] == null) {
            return 0d;
        }
        return ((Number) aggregate[2]).doubleValue();
    }

    private double callCount(McpAlertRuleEntity rule, Instant from, Instant to) {
        long count = auditLogRepository.search(rule.getTenantId(), null, null, null, "SUCCESS",
                        from, to, org.springframework.data.domain.PageRequest.of(0, 1))
                .getTotalElements();
        return (double) count;
    }
}