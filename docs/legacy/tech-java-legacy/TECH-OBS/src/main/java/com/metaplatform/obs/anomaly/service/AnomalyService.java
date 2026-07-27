package com.metaplatform.obs.anomaly.service;

import com.metaplatform.obs.anomaly.client.RemediationClient;
import com.metaplatform.obs.anomaly.dto.AnomalyEventResponse;
import com.metaplatform.obs.anomaly.dto.AnomalyRuleRequest;
import com.metaplatform.obs.anomaly.dto.RemediationRequest;
import com.metaplatform.obs.anomaly.dto.RemediationResult;
import com.metaplatform.obs.anomaly.dto.RootCauseAnalysisResult;
import com.metaplatform.obs.anomaly.entity.AnomalyDetectionRuleEntity;
import com.metaplatform.obs.anomaly.entity.AnomalyEventEntity;
import com.metaplatform.obs.anomaly.repository.AnomalyDetectionRuleRepository;
import com.metaplatform.obs.anomaly.repository.AnomalyEventRepository;
import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.exception.ObsException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnomalyService {

    private static final Set<String> VALID_OPERATORS = Set.of("GT", "LT", "EQ", "GTE", "LTE");
    private static final Set<String> VALID_AGGREGATIONS = Set.of("AVG", "SUM", "COUNT", "MAX", "MIN");
    private static final Set<String> VALID_SEVERITIES = Set.of("INFO", "WARNING", "CRITICAL");

    private final AnomalyDetectionRuleRepository ruleRepository;
    private final AnomalyEventRepository eventRepository;
    private final AnomalyDetectionService detectionService;
    private final RootCauseAnalysisService rootCauseAnalysisService;
    private final RemediationClient remediationClient;

    public AnomalyDetectionRuleEntity createRule(AnomalyRuleRequest request) {
        validateRuleRequest(request);
        AnomalyDetectionRuleEntity entity = AnomalyDetectionRuleEntity.builder()
                .tenantId(TenantContext.get())
                .name(request.getName())
                .metricType(request.getMetricType().toUpperCase())
                .conditionOperator(request.getConditionOperator().toUpperCase())
                .threshold(request.getThreshold())
                .timeWindowSeconds(request.getTimeWindowSeconds() == null || request.getTimeWindowSeconds() <= 0
                        ? 300 : request.getTimeWindowSeconds())
                .aggregationFunction(request.getAggregationFunction().toUpperCase())
                .severity(request.getSeverity() != null ? request.getSeverity().toUpperCase() : "WARNING")
                .enabled(request.getEnabled() == null || request.getEnabled())
                .build();
        return ruleRepository.insert(entity);
    }

    public AnomalyDetectionRuleEntity updateRule(UUID id, AnomalyRuleRequest request) {
        validateRuleRequest(request);
        AnomalyDetectionRuleEntity existing = ruleRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.ANOMALY_RULE_NOT_FOUND, "检测规则不存在: " + id));
        existing.setName(request.getName());
        existing.setMetricType(request.getMetricType().toUpperCase());
        existing.setConditionOperator(request.getConditionOperator().toUpperCase());
        existing.setThreshold(request.getThreshold());
        existing.setTimeWindowSeconds(request.getTimeWindowSeconds() == null || request.getTimeWindowSeconds() <= 0
                ? 300 : request.getTimeWindowSeconds());
        existing.setAggregationFunction(request.getAggregationFunction().toUpperCase());
        existing.setSeverity(request.getSeverity() != null ? request.getSeverity().toUpperCase() : "WARNING");
        existing.setEnabled(request.getEnabled() == null || request.getEnabled());
        return ruleRepository.update(existing);
    }

    public void deleteRule(UUID id) {
        AnomalyDetectionRuleEntity existing = ruleRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.ANOMALY_RULE_NOT_FOUND, "检测规则不存在: " + id));
        int rows = ruleRepository.softDelete(existing.getId());
        if (rows == 0) {
            throw new ObsException(ErrorCode.INTERNAL_ERROR, "删除检测规则失败");
        }
    }

    public AnomalyDetectionRuleEntity getRule(UUID id) {
        return ruleRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.ANOMALY_RULE_NOT_FOUND, "检测规则不存在: " + id));
    }

    public List<AnomalyDetectionRuleEntity> listRules() {
        return ruleRepository.findAll(TenantContext.get());
    }

    public List<AnomalyEventResponse> listEvents(String status) {
        String tenantId = TenantContext.get();
        List<AnomalyEventEntity> events;
        if (status != null && !status.isBlank()) {
            events = eventRepository.findByTenantAndStatus(tenantId, status.toUpperCase());
        } else {
            events = eventRepository.findByTenant(tenantId);
        }
        return events.stream().map(this::toEventResponse).toList();
    }

    public AnomalyEventResponse getEvent(UUID id) {
        return eventRepository.findById(id)
                .map(this::toEventResponse)
                .orElseThrow(() -> new ObsException(ErrorCode.ANOMALY_NOT_FOUND, "异常事件不存在: " + id));
    }

    @Transactional
    public RootCauseAnalysisResult analyze(UUID id) {
        AnomalyEventEntity event = eventRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.ANOMALY_NOT_FOUND, "异常事件不存在: " + id));
        RootCauseAnalysisResult result = rootCauseAnalysisService.analyze(event);
        eventRepository.updateRootCause(id, result.getConclusion());
        eventRepository.updateRemediationAction(id, result.getSuggestedAction());
        eventRepository.updateStatus(id, "ANALYZING", null);
        return result;
    }

    @Transactional
    public RemediationResult remediate(UUID id, RemediationRequest request) {
        AnomalyEventEntity event = eventRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.ANOMALY_NOT_FOUND, "异常事件不存在: " + id));
        String actionCode = request.getActionCode() != null && !request.getActionCode().isBlank()
                ? request.getActionCode()
                : event.getRemediationAction();
        String mode = request.getMode() != null ? request.getMode() : "ADVISE";
        RemediationResult result = remediationClient.remediate(
                event.getAnomalyType(), event.getServiceName(), actionCode, mode, event.getTraceId());
        if (result.isExecuted()) {
            eventRepository.updateStatus(id, "RESOLVED", Instant.now());
        }
        return result;
    }

    public List<AnomalyEventEntity> detectNow() {
        return detectionService.detectAnomalies(TenantContext.get());
    }

    private AnomalyEventResponse toEventResponse(AnomalyEventEntity entity) {
        return AnomalyEventResponse.builder()
                .id(entity.getId())
                .ruleId(entity.getRuleId())
                .anomalyType(entity.getAnomalyType())
                .severity(entity.getSeverity())
                .serviceName(entity.getServiceName())
                .traceId(entity.getTraceId())
                .metricValue(entity.getMetricValue())
                .rootCause(entity.getRootCause())
                .remediationAction(entity.getRemediationAction())
                .status(entity.getStatus())
                .detectedAt(entity.getDetectedAt())
                .resolvedAt(entity.getResolvedAt())
                .build();
    }

    private void validateRuleRequest(AnomalyRuleRequest request) {
        if (request == null) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "请求体不能为空");
        }
        if (request.getMetricType() == null || request.getMetricType().isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "metricType 不能为空");
        }
        if (request.getConditionOperator() == null
                || !VALID_OPERATORS.contains(request.getConditionOperator().toUpperCase())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "conditionOperator 必须是 GT/LT/EQ/GTE/LTE 之一");
        }
        if (request.getAggregationFunction() == null
                || !VALID_AGGREGATIONS.contains(request.getAggregationFunction().toUpperCase())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "aggregationFunction 必须是 AVG/SUM/COUNT/MAX/MIN 之一");
        }
        if (request.getSeverity() != null
                && !VALID_SEVERITIES.contains(request.getSeverity().toUpperCase())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "severity 必须是 INFO/WARNING/CRITICAL 之一");
        }
    }
}
