package com.metaplatform.wfe.apphub.controller;

import com.metaplatform.wfe.apphub.dto.ReleaseApprovalCompleteRequest;
import com.metaplatform.wfe.apphub.dto.ReleaseApprovalStartRequest;
import com.metaplatform.wfe.apphub.service.ReleaseApprovalProcessService;
import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 应用发布审批流程 API（V14-05）：
 *   基于 TECH-WFE BPMN 引擎，提供发布审批流程的启动、任务查询与审批完成能力。
 */
@RestController
@RequestMapping("/api/v1/wfe/release-approval")
@RequiredArgsConstructor
public class ReleaseApprovalProcessController {

    private final ReleaseApprovalProcessService releaseApprovalProcessService;

    @PostMapping("/start")
    public ApiResponse<ProcessInstanceResponse> start(
            @Valid @RequestBody ReleaseApprovalStartRequest request) {
        return ApiResponse.success(releaseApprovalProcessService.start(request, request.getAppId() + ":" + request.getVersion()));
    }

    @GetMapping("/{processInstanceId}/tasks")
    public ApiResponse<List<TaskResponse>> getTasks(@PathVariable String processInstanceId) {
        return ApiResponse.success(releaseApprovalProcessService.getTasks(processInstanceId));
    }

    @PostMapping("/{processInstanceId}/tasks/{taskId}/complete")
    public ApiResponse<TaskActionResponse> complete(
            @PathVariable String processInstanceId,
            @PathVariable String taskId,
            @Valid @RequestBody ReleaseApprovalCompleteRequest request) {
        return ApiResponse.success(releaseApprovalProcessService.complete(processInstanceId, taskId, request));
    }
}
