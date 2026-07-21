package com.metaplatform.obs.anomaly.controller;

import com.metaplatform.obs.anomaly.dto.AnomalyEventResponse;
import com.metaplatform.obs.anomaly.dto.AnomalyRuleRequest;
import com.metaplatform.obs.anomaly.dto.RemediationRequest;
import com.metaplatform.obs.anomaly.dto.RemediationResult;
import com.metaplatform.obs.anomaly.dto.RootCauseAnalysisResult;
import com.metaplatform.obs.anomaly.entity.AnomalyDetectionRuleEntity;
import com.metaplatform.obs.anomaly.entity.AnomalyEventEntity;
import com.metaplatform.obs.anomaly.service.AnomalyService;
import com.metaplatform.obs.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs")
@RequiredArgsConstructor
public class AnomalyController {

    private final AnomalyService anomalyService;

    @GetMapping("/anomalies")
    public ApiResponse<List<AnomalyEventResponse>> listAnomalies(@RequestParam(required = false) String status) {
        log.debug("List anomalies: status={}", status);
        return ApiResponse.success(anomalyService.listEvents(status));
    }

    @GetMapping("/anomalies/{id}")
    public ApiResponse<AnomalyEventResponse> getAnomaly(@PathVariable UUID id) {
        log.debug("Get anomaly: {}", id);
        return ApiResponse.success(anomalyService.getEvent(id));
    }

    @PostMapping("/anomalies/{id}/analyze")
    public ApiResponse<RootCauseAnalysisResult> analyzeAnomaly(@PathVariable UUID id) {
        log.debug("Analyze anomaly: {}", id);
        return ApiResponse.success(anomalyService.analyze(id));
    }

    @PostMapping("/anomalies/{id}/remediate")
    public ApiResponse<RemediationResult> remediateAnomaly(@PathVariable UUID id,
                                                           @Valid @RequestBody(required = false)
                                                           RemediationRequest request) {
        log.debug("Remediate anomaly: {}, mode={}", id, request != null ? request.getMode() : "ADVISE");
        return ApiResponse.success(anomalyService.remediate(id,
                request != null ? request : RemediationRequest.builder().mode("ADVISE").build()));
    }

    @PostMapping("/anomalies/detect")
    public ApiResponse<List<AnomalyEventEntity>> detectAnomalies() {
        log.debug("Trigger anomaly detection");
        return ApiResponse.success(anomalyService.detectNow());
    }

    @GetMapping("/anomaly-rules")
    public ApiResponse<List<AnomalyDetectionRuleEntity>> listRules() {
        log.debug("List anomaly detection rules");
        return ApiResponse.success(anomalyService.listRules());
    }

    @PostMapping("/anomaly-rules")
    public ApiResponse<AnomalyDetectionRuleEntity> createRule(@Valid @RequestBody AnomalyRuleRequest request) {
        log.debug("Create anomaly detection rule: metricType={}", request.getMetricType());
        return ApiResponse.success(anomalyService.createRule(request));
    }

    @GetMapping("/anomaly-rules/{id}")
    public ApiResponse<AnomalyDetectionRuleEntity> getRule(@PathVariable UUID id) {
        log.debug("Get anomaly detection rule: {}", id);
        return ApiResponse.success(anomalyService.getRule(id));
    }

    @PutMapping("/anomaly-rules/{id}")
    public ApiResponse<AnomalyDetectionRuleEntity> updateRule(@PathVariable UUID id,
                                                              @Valid @RequestBody AnomalyRuleRequest request) {
        log.debug("Update anomaly detection rule: {}", id);
        return ApiResponse.success(anomalyService.updateRule(id, request));
    }

    @DeleteMapping("/anomaly-rules/{id}")
    public ApiResponse<Void> deleteRule(@PathVariable UUID id) {
        log.debug("Delete anomaly detection rule: {}", id);
        anomalyService.deleteRule(id);
        return ApiResponse.success();
    }
}
