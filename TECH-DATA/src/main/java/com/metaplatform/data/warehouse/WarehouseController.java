package com.metaplatform.data.warehouse;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.warehouse.dto.MaterializedViewResponse;
import com.metaplatform.data.warehouse.dto.WarehouseLayerResponse;
import com.metaplatform.data.warehouse.dto.WarehouseQueryResponse;
import com.metaplatform.data.warehouse.dto.WarehouseTableResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 数据仓库端点。
 *
 * <p>对应 Python app/api/v1/warehouse.py（7 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/warehouse")
@RequiredArgsConstructor
public class WarehouseController {

    private final WarehouseService warehouseService;

    @PostMapping("/query")
    public ApiResponse<WarehouseQueryResponse> query(
            @RequestParam String layer,
            @RequestParam String sql) {
        return ApiResponse.success(warehouseService.query(layer, sql));
    }

    @GetMapping("/layers")
    public ApiResponse<WarehouseLayerResponse> listLayers() {
        return ApiResponse.success(warehouseService.listLayers());
    }

    @GetMapping("/layers/{layer}/tables")
    public ApiResponse<PageResponse<WarehouseTableResponse>> listTables(
            @RequestParam String layer,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(warehouseService.listTables(layer, page, pageSize));
    }

    @GetMapping("/materialized-views")
    public ApiResponse<PageResponse<MaterializedViewResponse>> listMaterializedViews(
            @RequestParam(required = false) String schema,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(warehouseService.listMaterializedViews(schema, page, pageSize));
    }

    @GetMapping("/materialized-views/refresh")
    public ApiResponse<PageResponse<MaterializedViewResponse>> refreshMaterializedViews(
            @RequestParam(required = false) String schema,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(warehouseService.listMaterializedViews(schema, page, pageSize));
    }

    @GetMapping("/history")
    public ApiResponse<PageResponse<WarehouseQueryResponse>> history(
            @RequestParam(required = false) String layer,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(warehouseService.history(layer, page, pageSize));
    }
}
