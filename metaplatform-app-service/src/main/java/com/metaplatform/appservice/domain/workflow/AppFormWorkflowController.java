package com.metaplatform.appservice.domain.workflow;

import com.metaplatform.appservice.api.error.ApiResponse;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 表单与流程定义绑定接口。
 */
@RestController
@RequestMapping("/api/apps/{appId}/forms/{formId}/workflow")
public class AppFormWorkflowController {

    private final AppFormWorkflowService service;

    public AppFormWorkflowController(AppFormWorkflowService service) {
        this.service = service;
    }

    @PostMapping
    public ApiResponse<AppFormWorkflowEntity> bind(@PathVariable String appId,
                                                   @PathVariable Long formId,
                                                   @RequestBody Map<String, Long> body) {
        Long workflowDefinitionId = body.get("workflowDefinitionId");
        if (workflowDefinitionId == null) {
            throw new IllegalArgumentException("需要 workflowDefinitionId");
        }
        return ApiResponse.ok(service.bind(appId, formId, workflowDefinitionId), MDC.get("traceId"));
    }

    @GetMapping
    public ApiResponse<AppFormWorkflowEntity> get(@PathVariable String appId, @PathVariable Long formId) {
        return service.findEnabled(appId, formId)
                .map(e -> ApiResponse.ok(e, MDC.get("traceId")))
                .orElse(ApiResponse.ok(null, MDC.get("traceId")));
    }

    @DeleteMapping
    public ApiResponse<Map<String, String>> unbind(@PathVariable String appId, @PathVariable Long formId) {
        service.unbind(appId, formId);
        return ApiResponse.ok(Map.of("unbound", "true"), MDC.get("traceId"));
    }
}
