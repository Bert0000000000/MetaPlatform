package com.metaplatform.wfe.controller;

import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.dto.DeployRequest;
import com.metaplatform.wfe.dto.ProcessDefinitionResponse;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import com.metaplatform.wfe.service.ProcessDefinitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/wfe/process-definitions")
@RequiredArgsConstructor
public class ProcessDefinitionController {

    private final ProcessDefinitionService processDefinitionService;

    @PostMapping("/deploy")
    public ApiResponse<ProcessDefinitionResponse> deploy(@Valid @RequestBody DeployRequest request) {
        return ApiResponse.success(processDefinitionService.deploy(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<ProcessDefinitionResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) ProcessDefinitionStatus status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(processDefinitionService.list(tenantId, status, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<ProcessDefinitionResponse> getById(@PathVariable String id) {
        return ApiResponse.success(processDefinitionService.getById(id));
    }

    @PutMapping("/{id}/suspend")
    public ApiResponse<ProcessDefinitionResponse> suspend(@PathVariable String id) {
        return ApiResponse.success(processDefinitionService.suspend(id));
    }

    @PutMapping("/{id}/activate")
    public ApiResponse<ProcessDefinitionResponse> activate(@PathVariable String id) {
        return ApiResponse.success(processDefinitionService.activate(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        processDefinitionService.delete(id);
        return ApiResponse.success();
    }
}
