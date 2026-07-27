package com.metaplatform.wfe.taskoperation.controller;

import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.taskoperation.dto.AddSignRequest;
import com.metaplatform.wfe.taskoperation.dto.DelegateRequest;
import com.metaplatform.wfe.taskoperation.dto.TaskHistoryEntry;
import com.metaplatform.wfe.taskoperation.dto.TaskMonitoringStatistics;
import com.metaplatform.wfe.taskoperation.dto.TaskOperationResponse;
import com.metaplatform.wfe.taskoperation.dto.UrgeRequest;
import com.metaplatform.wfe.taskoperation.service.TaskHistoryService;
import com.metaplatform.wfe.taskoperation.service.TaskMonitoringService;
import com.metaplatform.wfe.taskoperation.service.TaskOperationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/wfe/tasks")
@RequiredArgsConstructor
public class TaskOperationController {

    private final TaskOperationService taskOperationService;
    private final TaskHistoryService taskHistoryService;
    private final TaskMonitoringService taskMonitoringService;

    @PostMapping("/{id}/addsign")
    public ApiResponse<TaskOperationResponse> addSign(@PathVariable String id,
                                                      @Valid @RequestBody AddSignRequest request) {
        return ApiResponse.success(taskOperationService.addSign(id, request));
    }

    @PostMapping("/{id}/delegate")
    public ApiResponse<TaskOperationResponse> delegate(@PathVariable String id,
                                                       @Valid @RequestBody DelegateRequest request) {
        return ApiResponse.success(taskOperationService.delegate(id, request));
    }

    @PostMapping("/{id}/urge")
    public ApiResponse<TaskOperationResponse> urge(@PathVariable String id,
                                                   @Valid @RequestBody UrgeRequest request) {
        return ApiResponse.success(taskOperationService.urge(id, request));
    }

    @GetMapping("/{id}/history")
    public ApiResponse<List<TaskHistoryEntry>> history(@PathVariable String id) {
        return ApiResponse.success(taskHistoryService.getHistory(id));
    }

    @GetMapping("/monitoring/statistics")
    public ApiResponse<TaskMonitoringStatistics> statistics() {
        return ApiResponse.success(taskMonitoringService.statistics());
    }
}