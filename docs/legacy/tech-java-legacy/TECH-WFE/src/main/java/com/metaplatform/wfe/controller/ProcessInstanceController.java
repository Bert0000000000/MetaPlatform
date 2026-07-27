package com.metaplatform.wfe.controller;

import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.dto.BindVariableRequest;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
import com.metaplatform.wfe.dto.StartProcessInstanceRequest;
import com.metaplatform.wfe.dto.TaskResponse;
import com.metaplatform.wfe.entity.ProcessInstanceStatus;
import com.metaplatform.wfe.service.ProcessInstanceService;
import com.metaplatform.wfe.service.WfeTaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/wfe/process-instances")
@RequiredArgsConstructor
public class ProcessInstanceController {

    private final ProcessInstanceService processInstanceService;
    private final WfeTaskService wfeTaskService;

    @PostMapping
    public ApiResponse<ProcessInstanceResponse> start(@Valid @RequestBody StartProcessInstanceRequest request) {
        return ApiResponse.success(processInstanceService.start(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<ProcessInstanceResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) ProcessInstanceStatus status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(processInstanceService.list(tenantId, status, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<ProcessInstanceResponse> getById(@PathVariable String id) {
        return ApiResponse.success(processInstanceService.getById(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> terminate(@PathVariable String id) {
        processInstanceService.terminate(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/tasks")
    public ApiResponse<List<TaskResponse>> getTasks(@PathVariable String id) {
        return ApiResponse.success(wfeTaskService.getTasksByProcessInstance(id));
    }

    // P1-WFE-08: 流程变量绑定业务对象
    @PostMapping("/{id}/bind")
    public ApiResponse<ProcessInstanceResponse> bindVariable(
            @PathVariable String id,
            @Valid @RequestBody BindVariableRequest request) {
        return ApiResponse.success(processInstanceService.bindVariable(id, request));
    }
}
