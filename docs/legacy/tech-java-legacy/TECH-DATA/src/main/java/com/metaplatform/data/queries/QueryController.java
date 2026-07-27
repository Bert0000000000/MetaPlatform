package com.metaplatform.data.queries;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.queries.dto.ExecuteQueryRequest;
import com.metaplatform.data.queries.dto.QueryExecuteResponse;
import com.metaplatform.data.queries.dto.QueryHistoryResponse;
import com.metaplatform.data.queries.dto.QueryPlanResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/**
 * SQL 查询端点。
 *
 * <p>对应 Python app/api/v1/queries.py（4 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/queries")
@RequiredArgsConstructor
public class QueryController {

    private final QueryService queryService;

    /**
     * 执行查询。
     */
    @PostMapping("/execute")
    public ApiResponse<QueryExecuteResponse> execute(@Valid @RequestBody ExecuteQueryRequest request) {
        return ApiResponse.success(queryService.execute(request));
    }

    /**
     * 查询执行计划。
     */
    @PostMapping("/plan")
    public ApiResponse<QueryPlanResponse> plan(
            @RequestParam String datasourceId,
            @RequestParam String sql) {
        return ApiResponse.success(queryService.plan(datasourceId, sql));
    }

    /**
     * 导出查询结果。
     */
    @PostMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam String datasourceId,
            @RequestParam String sql,
            @RequestParam(defaultValue = "csv") String format) {
        String content = queryService.export(datasourceId, sql, format);
        String ext = "csv".equalsIgnoreCase(format) ? "csv" : "json";
        String filename = "query-export-" + System.currentTimeMillis() + "." + ext;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(content.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 查询历史。
     */
    @GetMapping("/history")
    public ApiResponse<PageResponse<QueryHistoryResponse>> history(
            @RequestParam(required = false) String datasourceId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(queryService.history(datasourceId, page, pageSize));
    }
}
