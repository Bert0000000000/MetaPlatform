package com.metaplatform.obs.anomaly.service;

import com.metaplatform.obs.anomaly.entity.AnomalyDetectionRuleEntity;
import com.metaplatform.obs.anomaly.entity.AnomalyEventEntity;
import com.metaplatform.obs.anomaly.repository.AnomalyDetectionRuleRepository;
import com.metaplatform.obs.anomaly.repository.AnomalyEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnomalyDetectionService {

    private static final Set<String> VALID_OPERATORS = Set.of("GT", "LT", "EQ", "GTE", "LTE");
    private static final List<String> MONITORED_SERVICES = List.of(
            "tech-ont", "tech-action", "tech-obs", "app-dashboard", "tech-wfe");

    private final AnomalyDetectionRuleRepository ruleRepository;
    private final AnomalyEventRepository eventRepository;

    public List<AnomalyEventEntity> detectAnomalies(String tenantId) {
        List<AnomalyDetectionRuleEntity> rules = ruleRepository.findAllEnabled(tenantId);
        List<AnomalyEventEntity> detected = new ArrayList<>();
        for (AnomalyDetectionRuleEntity rule : rules) {
            for (String serviceName : MONITORED_SERVICES) {
                double value = MockMetricProvider.getMetric(rule.getMetricType(), serviceName);
                if (matches(rule, value)) {
                    AnomalyEventEntity event = AnomalyEventEntity.builder()
                            .tenantId(tenantId)
                            .ruleId(rule.getId())
                            .anomalyType(rule.getMetricType())
                            .severity(rule.getSeverity())
                            .serviceName(serviceName)
                            .traceId("trace-" + UUID.randomUUID())
                            .metricValue(value)
                            .status("OPEN")
                            .detectedAt(Instant.now())
                            .build();
                    detected.add(eventRepository.insert(event));
                }
            }
        }
        log.debug("Detected {} anomaly events for tenant {}", detected.size(), tenantId);
        return detected;
    }

    boolean matches(AnomalyDetectionRuleEntity rule, double value) {
        String op = rule.getConditionOperator() != null ? rule.getConditionOperator().toUpperCase() : "GT";
        if (!VALID_OPERATORS.contains(op)) {
            return false;
        }
        return switch (op) {
            case "GT" -> value > rule.getThreshold();
            case "GTE" -> value >= rule.getThreshold();
            case "LT" -> value < rule.getThreshold();
            case "LTE" -> value <= rule.getThreshold();
            case "EQ" -> Double.compare(value, rule.getThreshold()) == 0;
            default -> false;
        };
    }

    /**
     * 基于服务名和指标类型返回 mock 指标值，用于异常检测演示。
     */
    static final class MockMetricProvider {

        private MockMetricProvider() {
        }

        static double getMetric(String metricType, String serviceName) {
            String type = metricType != null ? metricType.toUpperCase() : "ERROR_RATE";
            return switch (type) {
                case "ERROR_RATE" -> errorRateFor(serviceName);
                case "P99_LATENCY" -> p99LatencyFor(serviceName);
                case "ERROR_CODE" -> errorCodeCountFor(serviceName);
                default -> 0.0;
            };
        }

        private static double errorRateFor(String serviceName) {
            return switch (serviceName) {
                case "tech-obs" -> 12.5;
                case "tech-action" -> 3.2;
                case "tech-ont" -> 0.8;
                case "app-dashboard" -> 1.5;
                default -> 0.5;
            };
        }

        private static double p99LatencyFor(String serviceName) {
            return switch (serviceName) {
                case "tech-action" -> 1250.0;
                case "tech-wfe" -> 980.0;
                case "tech-obs" -> 620.0;
                case "tech-ont" -> 310.0;
                default -> 150.0;
            };
        }

        private static double errorCodeCountFor(String serviceName) {
            return switch (serviceName) {
                case "tech-ont" -> 18.0;
                case "tech-action" -> 7.0;
                case "tech-obs" -> 4.0;
                default -> 1.0;
            };
        }
    }
}
