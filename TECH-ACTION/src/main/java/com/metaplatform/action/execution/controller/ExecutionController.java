package com.metaplatform.action.execution.controller;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.service.HttpExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/action/executions")
@RequiredArgsConstructor
public class ExecutionController {

    private final HttpExecutionService httpExecutionService;

    @PostMapping("/sync")
    public ApiResponse<SyncExecutionResponse> executeSync(@Valid @RequestBody SyncExecutionRequest request) {
        return ApiResponse.success(httpExecutionService.executeSync(request));
    }
}
