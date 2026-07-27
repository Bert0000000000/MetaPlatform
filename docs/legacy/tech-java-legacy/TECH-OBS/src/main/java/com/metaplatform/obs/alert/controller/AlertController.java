package com.metaplatform.obs.alert.controller;

import com.metaplatform.obs.alert.dto.AlertStatistics;
import com.metaplatform.obs.alert.dto.SilenceRequest;
import com.metaplatform.obs.alert.entity.AlertEntity;
import com.metaplatform.obs.alert.entity.AlertSilenceEntity;
import com.metaplatform.obs.alert.service.AlertService;
import com.metaplatform.obs.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    public ApiResponse<List<AlertEntity>> listAlerts(@RequestParam(required = false) String status) {
        log.debug("List alerts: status={}", status);
        return ApiResponse.success(alertService.listAlerts(status));
    }

    @PostMapping("/{id}/silence")
    public ApiResponse<AlertSilenceEntity> silenceAlert(@PathVariable UUID id,
                                                         @Valid @RequestBody SilenceRequest request) {
        log.debug("Silence alert: {}, duration={}", id, request.getDurationSeconds());
        return ApiResponse.success(alertService.silenceAlert(id, request));
    }

    @PostMapping("/{id}/recover")
    public ApiResponse<AlertEntity> recoverAlert(@PathVariable UUID id) {
        log.debug("Recover alert: {}", id);
        return ApiResponse.success(alertService.recoverAlert(id));
    }

    @GetMapping("/history")
    public ApiResponse<List<AlertEntity>> getHistory(
            @RequestParam UUID ruleId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime) {
        log.debug("Alert history: ruleId={}, start={}, end={}", ruleId, startTime, endTime);
        return ApiResponse.success(alertService.getHistory(ruleId, startTime, endTime));
    }

    @GetMapping("/statistics")
    public ApiResponse<AlertStatistics> getStatistics() {
        log.debug("Alert statistics");
        return ApiResponse.success(alertService.getStatistics());
    }
}