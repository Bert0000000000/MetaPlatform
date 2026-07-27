package com.metaplatform.data.schema;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.schema.dto.ColumnListResponse;
import com.metaplatform.data.schema.dto.DatabaseListResponse;
import com.metaplatform.data.schema.dto.TableListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Schema 发现端点。
 *
 * <p>对应 Python app/api/v1/schema.py（3 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/schema")
@RequiredArgsConstructor
public class SchemaController {

    private final SchemaDiscoveryService schemaService;

    /**
     * 列出数据源下的所有数据库。
     */
    @GetMapping("/{datasourceId}/databases")
    public ApiResponse<DatabaseListResponse> listDatabases(@PathVariable String datasourceId) {
        return ApiResponse.success(schemaService.listDatabases(datasourceId));
    }

    /**
     * 列出指定数据库下的所有表。
     */
    @GetMapping("/{datasourceId}/databases/{database}/tables")
    public ApiResponse<TableListResponse> listTables(
            @PathVariable String datasourceId,
            @PathVariable String database) {
        return ApiResponse.success(schemaService.listTables(datasourceId, database));
    }

    /**
     * 列出指定表的列信息。
     */
    @GetMapping("/{datasourceId}/databases/{database}/tables/{table}/columns")
    public ApiResponse<ColumnListResponse> listColumns(
            @PathVariable String datasourceId,
            @PathVariable String database,
            @PathVariable String table) {
        return ApiResponse.success(schemaService.listColumns(datasourceId, database, table));
    }
}
