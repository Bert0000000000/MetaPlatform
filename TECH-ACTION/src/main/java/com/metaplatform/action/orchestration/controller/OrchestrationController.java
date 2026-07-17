package com.metaplatform.action.orchestration.controller;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.orchestration.dto.CreateOrchestrationRequest;
import com.metaplatform.action.orchestration.dto.OrchestrationExecutionResponse;
import com.metaplatform.action.orchestration.dto.OrchestrationListItem;
import com.metaplatform.action.orchestration.dto.OrchestrationResponse;
import com.metaplatform.action.orchestration.dto.StartOrchestrationRequest;
import com.metaplatform.action.orchestration.dto.UpdateOrchestrationRequest;
import com.metaplatform.action.orchestration.service.OrchestrationExecutionService;
import com.metaplatform.action.orchestration.service.OrchestrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/action/orchestrations")
@RequiredArgsConstructor
public class OrchestrationController {

    private final OrchestrationService orchestrationService;
    private final OrchestrationExecutionService orchestrationExecutionService;

    @PostMapping
    public ApiResponse<OrchestrationResponse> create(@Valid @RequestBody CreateOrchestrationRequest request) {
        return ApiResponse.success(orchestrationService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<OrchestrationListItem>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(orchestrationService.list(status, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<OrchestrationResponse> get(@PathVariable String id) {
        return ApiResponse.success(orchestrationService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<OrchestrationResponse> update(@PathVariable String id,
                                                      @Valid @RequestBody UpdateOrchestrationRequest request) {
        return ApiResponse.success(orchestrationService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        orchestrationService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<OrchestrationResponse> publish(@PathVariable String id) {
        return ApiResponse.success(orchestrationService.publish(id));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<OrchestrationResponse> disable(@PathVariable String id) {
        return ApiResponse.success(orchestrationService.disable(id));
    }

    @PostMapping("/{id}/condition-rules")
    public ApiResponse<OrchestrationResponse> configureConditionRules(@PathVariable String id,
                                                                      @RequestBody String ruleIntegration) {
        return ApiResponse.success(orchestrationService.configureConditionRules(id, ruleIntegration));
    }

    @PostMapping("/{id}/execute")
    public ApiResponse<String> execute(@PathVariable String id,
                                       @RequestBody(required = false) StartOrchestrationRequest request) {
        return ApiResponse.success(orchestrationExecutionService.startExecution(id, request));
    }

    @GetMapping("/executions/{executionId}")
    public ApiResponse<OrchestrationExecutionResponse> getExecution(@PathVariable String executionId) {
        return ApiResponse.success(orchestrationExecutionService.getExecution(executionId));
    }
}
