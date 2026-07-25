package com.metaplatform.data.lakehouse;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.lakehouse.dto.CreateIngestTaskRequest;
import com.metaplatform.data.lakehouse.dto.CreateLakeTableRequest;
import com.metaplatform.data.lakehouse.dto.IngestTaskResponse;
import com.metaplatform.data.lakehouse.dto.LakeTableResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 数据湖端点。
 *
 * <p>对应 Python app/api/v1/lakehouse.py（8 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/lakehouse")
@RequiredArgsConstructor
public class LakehouseController {

    private final LakehouseService lakehouseService;

    @PostMapping("/tables")
    public ApiResponse<LakeTableResponse> createTable(@Valid @RequestBody CreateLakeTableRequest request) {
        return ApiResponse.success(lakehouseService.createTable(request));
    }

    @GetMapping("/tables")
    public ApiResponse<PageResponse<LakeTableResponse>> listTables(
            @RequestParam(required = false) String database,
            @RequestParam(required = false) String format,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(lakehouseService.listTables(database, format, page, pageSize));
    }

    @GetMapping("/tables/{tableId}")
    public ApiResponse<LakeTableResponse> getTable(@PathVariable String tableId) {
        return ApiResponse.success(lakehouseService.getTable(tableId));
    }

    @DeleteMapping("/tables/{tableId}")
    public ApiResponse<Map<String, Object>> deleteTable(@PathVariable String tableId) {
        boolean ok = lakehouseService.deleteTable(tableId);
        return ApiResponse.success(Map.of("deleted", ok, "tableId", tableId));
    }

    @PostMapping("/ingests")
    public ApiResponse<IngestTaskResponse> createIngestTask(@Valid @RequestBody CreateIngestTaskRequest request) {
        return ApiResponse.success(lakehouseService.createIngestTask(request));
    }

    @GetMapping("/ingests")
    public ApiResponse<PageResponse<IngestTaskResponse>> listIngestTasks(
            @RequestParam(required = false) String targetTableId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(lakehouseService.listIngestTasks(targetTableId, page, pageSize));
    }

    @DeleteMapping("/ingests/{taskId}")
    public ApiResponse<Map<String, Object>> deleteIngestTask(@PathVariable String taskId) {
        boolean ok = lakehouseService.deleteIngestTask(taskId);
        return ApiResponse.success(Map.of("deleted", ok, "taskId", taskId));
    }

    @PostMapping("/ingests/{taskId}/run")
    public ApiResponse<IngestTaskResponse> runIngestTask(@PathVariable String taskId) {
        return ApiResponse.success(lakehouseService.runIngestTask(taskId));
    }
}
