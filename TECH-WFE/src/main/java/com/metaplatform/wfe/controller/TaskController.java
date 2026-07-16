package com.metaplatform.wfe.controller;

import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.dto.TaskActionRequest;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
import com.metaplatform.wfe.service.WfeTaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/wfe/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final WfeTaskService wfeTaskService;

    @GetMapping("/todo")
    public ApiResponse<PageResponse<TaskResponse>> getTodoTasks(
            @RequestParam String userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(wfeTaskService.getTodoTasks(userId, page, size));
    }

    @GetMapping("/done")
    public ApiResponse<PageResponse<TaskResponse>> getDoneTasks(
            @RequestParam String userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(wfeTaskService.getDoneTasks(userId, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskResponse> getTaskById(@PathVariable String id) {
        return ApiResponse.success(wfeTaskService.getTaskById(id));
    }

    @PostMapping("/{id}/action")
    public ApiResponse<TaskActionResponse> executeAction(
            @PathVariable String id,
            @Valid @RequestBody TaskActionRequest request) {
        return ApiResponse.success(wfeTaskService.executeAction(id, request));
    }
}
