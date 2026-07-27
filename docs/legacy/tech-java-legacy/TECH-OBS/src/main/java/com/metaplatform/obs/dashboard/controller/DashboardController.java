package com.metaplatform.obs.dashboard.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.dashboard.dto.DashboardExport;
import com.metaplatform.obs.dashboard.dto.DashboardRequest;
import com.metaplatform.obs.dashboard.entity.DashboardEntity;
import com.metaplatform.obs.dashboard.service.DashboardService;
import com.metaplatform.obs.exception.ObsException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs/dashboards")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping
    public ApiResponse<DashboardEntity> create(@Valid @RequestBody DashboardRequest request) {
        log.debug("Create dashboard: {}", request.getTitle());
        return ApiResponse.success(dashboardService.create(request));
    }

    @GetMapping
    public ApiResponse<List<DashboardEntity>> list() {
        log.debug("List dashboards");
        return ApiResponse.success(dashboardService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<DashboardEntity> get(@PathVariable UUID id) {
        log.debug("Get dashboard: {}", id);
        return ApiResponse.success(dashboardService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<DashboardEntity> update(@PathVariable UUID id,
                                               @Valid @RequestBody DashboardRequest request) {
        log.debug("Update dashboard: {}", id);
        return ApiResponse.success(dashboardService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        log.debug("Delete dashboard: {}", id);
        dashboardService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/share")
    public ApiResponse<DashboardEntity> share(@PathVariable UUID id) {
        log.debug("Generate share token for dashboard: {}", id);
        return ApiResponse.success(dashboardService.generateShareToken(id));
    }

    @GetMapping("/shared/{token}")
    public ApiResponse<DashboardEntity> getShared(@PathVariable String token) {
        log.debug("Get shared dashboard by token");
        return ApiResponse.success(dashboardService.getByShareToken(token));
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable UUID id) {
        log.debug("Export dashboard: {}", id);
        DashboardExport export = dashboardService.export(id);
        String body;
        try {
            body = objectMapper.writeValueAsString(export);
        } catch (Exception e) {
            throw new ObsException(ErrorCode.INTERNAL_ERROR, "导出失败: " + e.getMessage());
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=dashboard-" + id + ".json")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body.getBytes(StandardCharsets.UTF_8));
    }
}