package com.metaplatform.appservice.domain.workflow;

import com.metaplatform.appservice.api.error.ApiResponse;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 流程定义管理接口。
 */
@RestController
@RequestMapping("/api/apps/{appId}/workflows")
public class AppWorkflowDefinitionController {

    private final AppWorkflowDefinitionService service;

    public AppWorkflowDefinitionController(AppWorkflowDefinitionService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AppWorkflowDefinitionEntity>> list(@PathVariable String appId) {
        return ApiResponse.ok(service.listByApp(appId), MDC.get("traceId"));
    }

    @GetMapping("/{id}")
    public ApiResponse<AppWorkflowDefinitionEntity> get(@PathVariable String appId, @PathVariable Long id) {
        return ApiResponse.ok(service.getById(appId, id), MDC.get("traceId"));
    }

    @PostMapping
    public ApiResponse<AppWorkflowDefinitionEntity> create(@PathVariable String appId,
                                                           @RequestBody WorkflowDefinitionRequest req) {
        return ApiResponse.ok(service.create(appId, req), MDC.get("traceId"));
    }

    @PutMapping("/{id}")
    public ApiResponse<AppWorkflowDefinitionEntity> update(@PathVariable String appId,
                                                           @PathVariable Long id,
                                                           @RequestBody WorkflowDefinitionRequest req) {
        return ApiResponse.ok(service.update(appId, id, req), MDC.get("traceId"));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<AppWorkflowDefinitionEntity> publish(@PathVariable String appId, @PathVariable Long id) {
        return ApiResponse.ok(service.publish(appId, id), MDC.get("traceId"));
    }

    @PostMapping("/{id}/suspend")
    public ApiResponse<AppWorkflowDefinitionEntity> suspend(@PathVariable String appId, @PathVariable Long id) {
        return ApiResponse.ok(service.suspend(appId, id), MDC.get("traceId"));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, String>> delete(@PathVariable String appId, @PathVariable Long id) {
        service.delete(appId, id);
        return ApiResponse.ok(Map.of("deleted", String.valueOf(id)), MDC.get("traceId"));
    }
}
