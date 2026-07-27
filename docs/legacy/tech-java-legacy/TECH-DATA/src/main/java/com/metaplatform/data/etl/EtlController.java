package com.metaplatform.data.etl;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.etl.dto.CreateEtlTaskRequest;
import com.metaplatform.data.etl.dto.EtlRunResponse;
import com.metaplatform.data.etl.dto.EtlTaskResponse;
import com.metaplatform.data.etl.dto.UpdateEtlTaskRequest;
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

import java.util.Map;

/**
 * ETL 任务端点。
 *
 * <p>对应 Python app/api/v1/etl.py（7 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/etl")
@RequiredArgsConstructor
public class EtlController {

    private final EtlTaskService etlTaskService;

    @PostMapping("/tasks")
    public ApiResponse<EtlTaskResponse> createTask(@Valid @RequestBody CreateEtlTaskRequest request) {
        return ApiResponse.success(etlTaskService.create(request));
    }

    @GetMapping("/tasks")
    public ApiResponse<PageResponse<EtlTaskResponse>> listTasks(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(etlTaskService.list(status, page, pageSize));
    }

    @GetMapping("/tasks/{taskId}")
    public ApiResponse<EtlTaskResponse> getTask(@PathVariable String taskId) {
        return ApiResponse.success(etlTaskService.get(taskId));
    }

    @PutMapping("/tasks/{taskId}")
    public ApiResponse<EtlTaskResponse> updateTask(
            @PathVariable String taskId,
            @Valid @RequestBody UpdateEtlTaskRequest request) {
        return ApiResponse.success(etlTaskService.update(taskId, request));
    }

    @DeleteMapping("/tasks/{taskId}")
    public ApiResponse<Map<String, Object>> deleteTask(@PathVariable String taskId) {
        boolean ok = etlTaskService.delete(taskId);
        return ApiResponse.success(Map.of("deleted", ok, "taskId", taskId));
    }

    @PostMapping("/tasks/{taskId}/trigger")
    public ApiResponse<EtlRunResponse> triggerTask(@PathVariable String taskId) {
        return ApiResponse.success(etlTaskService.trigger(taskId));
    }

    @GetMapping("/tasks/{taskId}/runs")
    public ApiResponse<PageResponse<EtlRunResponse>> listRuns(
            @PathVariable String taskId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(etlTaskService.runs(taskId, page, pageSize));
    }
}
