package com.metaplatform.ont.metric;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Metric REST API（P1.1.3）。
 *
 * <ul>
 *   <li>POST   /api/v1/ont/metrics</li>
 *   <li>PUT    /api/v1/ont/metrics/{id}</li>
 *   <li>GET    /api/v1/ont/metrics/{id}</li>
 *   <li>DELETE /api/v1/ont/metrics/{id}</li>
 *   <li>GET    /api/v1/ont/metrics?conceptCode=Customer</li>
 *   <li>GET    /api/v1/ont/metrics/{metricCode}/explain</li>
 *   <li>POST   /api/v1/ont/metrics/{metricCode}/execute</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/ont/metrics")
@RequiredArgsConstructor
public class MetricController {

    private final MetricService service;

    @PostMapping
    public ApiResponse<MetricEntity> create(@RequestBody MetricEntity entity) {
        entity.setTenantId(TenantContext.tenantIdOrDefault());
        return ApiResponse.success(service.create(entity));
    }

    @PutMapping("/{id}")
    public ApiResponse<MetricEntity> update(@PathVariable String id, @RequestBody MetricEntity patch) {
        return ApiResponse.success(service.update(id, patch));
    }

    @GetMapping("/{id}")
    public ApiResponse<MetricEntity> get(@PathVariable String id) {
        return ApiResponse.success(service.get(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ApiResponse.success();
    }

    @GetMapping
    public ApiResponse<List<MetricEntity>> list(@RequestParam(required = false) String conceptCode) {
        String tid = TenantContext.tenantIdOrDefault();
        return ApiResponse.success(conceptCode == null
                ? service.listAll(tid)
                : service.listByConcept(tid, conceptCode));
    }

    @GetMapping("/{metricCode}/explain")
    public ApiResponse<Map<String, Object>> explain(@PathVariable String metricCode) {
        return ApiResponse.success(service.explain(TenantContext.tenantIdOrDefault(), metricCode));
    }

    @PostMapping("/{metricCode}/execute")
    public ApiResponse<Object> execute(@PathVariable String metricCode,
                                        @RequestBody ExecuteRequest req) {
        return ApiResponse.success(service.execute(
                TenantContext.tenantIdOrDefault(),
                metricCode,
                req.objectId,
                req.params
        ));
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ExecuteRequest {
        private String objectId;
        private Map<String, Object> params;
    }
}
