package com.metaplatform.data.datasources;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.datasources.dto.CreateDataSourceRequest;
import com.metaplatform.data.datasources.dto.DataSourceResponse;
import com.metaplatform.data.datasources.dto.TestConnectionRequest;
import com.metaplatform.data.datasources.dto.TestConnectionResponse;
import com.metaplatform.data.datasources.dto.UpdateDataSourceRequest;
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
 * 数据源管理端点。
 *
 * <p>对应 Python app/api/v1/datasources.py（6 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/datasources")
@RequiredArgsConstructor
public class DataSourceController {

    private final DataSourceService dataSourceService;

    /**
     * 创建数据源。
     */
    @PostMapping
    public ApiResponse<DataSourceResponse> create(@Valid @RequestBody CreateDataSourceRequest request) {
        return ApiResponse.success(dataSourceService.create(request));
    }

    /**
     * 列表（分页 + 状态/关键词过滤）。
     */
    @GetMapping
    public ApiResponse<PageResponse<DataSourceResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(dataSourceService.list(status, keyword, page, pageSize));
    }

    /**
     * 详情。
     */
    @GetMapping("/{datasourceId}")
    public ApiResponse<DataSourceResponse> get(@PathVariable String datasourceId) {
        return ApiResponse.success(dataSourceService.get(datasourceId));
    }

    /**
     * 更新。
     */
    @PutMapping("/{datasourceId}")
    public ApiResponse<DataSourceResponse> update(
            @PathVariable String datasourceId,
            @Valid @RequestBody UpdateDataSourceRequest request) {
        return ApiResponse.success(dataSourceService.update(datasourceId, request));
    }

    /**
     * 删除。
     */
    @DeleteMapping("/{datasourceId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String datasourceId) {
        boolean ok = dataSourceService.delete(datasourceId);
        return ApiResponse.success(Map.of("deleted", ok, "datasourceId", datasourceId));
    }

    /**
     * 连接测试。
     */
    @PostMapping("/test-connection")
    public ApiResponse<TestConnectionResponse> testConnection(@RequestBody TestConnectionRequest request) {
        return ApiResponse.success(dataSourceService.testConnection(request));
    }
}
