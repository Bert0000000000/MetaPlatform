package com.metaplatform.obs.alert.controller;

import com.metaplatform.obs.alert.dto.AlertRuleRequest;
import com.metaplatform.obs.alert.entity.AlertRuleEntity;
import com.metaplatform.obs.alert.service.AlertService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs/alert-rules")
@RequiredArgsConstructor
public class AlertRuleController {

    private final AlertService alertService;

    @PostMapping
    public ApiResponse<AlertRuleEntity> createRule(@Valid @RequestBody AlertRuleRequest request) {
        log.debug("Create alert rule: metric={}, operator={}, threshold={}",
                request.getMetricName(), request.getConditionOperator(), request.getThreshold());
        return ApiResponse.success(alertService.createRule(request));
    }

    @GetMapping
    public ApiResponse<List<AlertRuleEntity>> listRules() {
        log.debug("List alert rules");
        return ApiResponse.success(alertService.listRules());
    }

    @GetMapping("/{id}")
    public ApiResponse<AlertRuleEntity> getRule(@PathVariable UUID id) {
        log.debug("Get alert rule: {}", id);
        return ApiResponse.success(alertService.getRule(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<AlertRuleEntity> updateRule(@PathVariable UUID id,
                                                   @Valid @RequestBody AlertRuleRequest request) {
        log.debug("Update alert rule: {}", id);
        return ApiResponse.success(alertService.updateRule(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteRule(@PathVariable UUID id) {
        log.debug("Delete alert rule: {}", id);
        alertService.deleteRule(id);
        return ApiResponse.success();
    }
}