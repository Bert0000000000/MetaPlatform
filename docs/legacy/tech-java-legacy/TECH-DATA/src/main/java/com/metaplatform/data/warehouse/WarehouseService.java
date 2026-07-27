package com.metaplatform.data.warehouse;

import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.MaterializedViewEntity;
import com.metaplatform.data.entity.WarehouseTableEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.repository.MaterializedViewRepository;
import com.metaplatform.data.repository.WarehouseTableRepository;
import com.metaplatform.data.warehouse.dto.MaterializedViewResponse;
import com.metaplatform.data.warehouse.dto.WarehouseLayerResponse;
import com.metaplatform.data.warehouse.dto.WarehouseQueryResponse;
import com.metaplatform.data.warehouse.dto.WarehouseTableResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * 数据仓库服务：查询 / 分层 / 表 / 物化视图 + 历史。
 *
 * <p>对应 Python app/warehouse/service.py 的 WarehouseService。</p>
 *
 * <p>持久化存储（warehouse_table / materialized_view 表）；query 方法为 stub，
 * 真实实现需对接 StarRocks JDBC。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WarehouseService {

    private static final List<String> LAYERS = List.of("ODS", "DWD", "DWS", "ADS");

    private final WarehouseTableRepository warehouseTableRepository;
    private final MaterializedViewRepository materializedViewRepository;

    /**
     * 查询数据仓库（stub：真实 StarRocks JDBC 查询由其他模块覆盖）。
     */
    @Transactional
    public WarehouseQueryResponse query(String layer, String sql) {
        validateLayer(layer);
        long start = System.currentTimeMillis();
        WarehouseQueryResponse response = WarehouseQueryResponse.builder()
                .queryId("wh-" + UUID.randomUUID().toString().replace("-", ""))
                .layer(layer)
                .sql(sql)
                .columns(Collections.emptyList())
                .rows(Collections.emptyList())
                .rowCount(0)
                .latencyMs(System.currentTimeMillis() - start)
                .executedAt(OffsetDateTime.now())
                .build();
        log.info("数仓查询(stub) | layer={} queryId={} latencyMs={}",
                layer, response.getQueryId(), response.getLatencyMs());
        return response;
    }

    /**
     * 获取分层信息。
     */
    @Transactional(readOnly = true)
    public WarehouseLayerResponse listLayers() {
        String tenantId = TenantContext.getTenantIdOrDefault();
        List<WarehouseLayerResponse.LayerInfo> layers = new ArrayList<>();
        for (String layer : LAYERS) {
            Page<WarehouseTableEntity> page = warehouseTableRepository.findByTenantIdAndLayer(
                    tenantId, layer, PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt")));
            long totalSize = page.getContent().stream()
                    .mapToLong(e -> e.getSizeBytes() != null ? e.getSizeBytes() : 0L)
                    .sum();
            layers.add(WarehouseLayerResponse.LayerInfo.builder()
                    .name(layer)
                    .description(descriptionFor(layer))
                    .tableCount((int) page.getTotalElements())
                    .totalSizeBytes(totalSize)
                    .build());
        }
        return WarehouseLayerResponse.builder().layers(layers).build();
    }

    /**
     * 列出分层下的表。
     */
    @Transactional(readOnly = true)
    public PageResponse<WarehouseTableResponse> listTables(String layer, int page, int pageSize) {
        validateLayer(layer);
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<WarehouseTableEntity> result = warehouseTableRepository.findByTenantIdAndLayer(
                tenantId, layer, pageable);
        return PageResponse.of(
                result.getContent().stream().map(this::toTableResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    /**
     * 列出物化视图。
     */
    @Transactional(readOnly = true)
    public PageResponse<MaterializedViewResponse> listMaterializedViews(String schema, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<MaterializedViewEntity> result = materializedViewRepository.findByTenantId(tenantId, pageable);
        return PageResponse.of(
                result.getContent().stream().map(this::toViewResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    /**
     * 历史查询记录（stub：无持久化查询历史，返回空）。
     */
    @Transactional(readOnly = true)
    public PageResponse<WarehouseQueryResponse> history(String layer, int page, int pageSize) {
        return PageResponse.empty(page, pageSize);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private void validateLayer(String layer) {
        if (layer == null || !LAYERS.contains(layer.toUpperCase())) {
            throw new DataException(ErrorCode.INVALID_PARAM, "非法分层: " + layer + "，应为 ODS/DWD/DWS/ADS");
        }
    }

    private String descriptionFor(String layer) {
        return switch (layer) {
            case "ODS" -> "原始数据层：贴源同步，保留全字段";
            case "DWD" -> "明细数据层：清洗与标准化后的明细数据";
            case "DWS" -> "汇总数据层：按主题轻度汇总";
            case "ADS" -> "应用数据层：面向业务应用的指标数据";
            default -> layer;
        };
    }

    private WarehouseTableResponse toTableResponse(WarehouseTableEntity entity) {
        return WarehouseTableResponse.builder()
                .name(entity.getTableName())
                .layer(entity.getLayer())
                .schema(entity.getDatabaseName() != null ? entity.getDatabaseName() : "public")
                .type("BASE TABLE")
                .rowCount(entity.getRowCount() != null ? entity.getRowCount() : 0L)
                .sizeBytes(entity.getSizeBytes() != null ? entity.getSizeBytes() : 0L)
                .engine("StarRocks")
                .lastModifiedAt(entity.getLastModifiedAt())
                .build();
    }

    private MaterializedViewResponse toViewResponse(MaterializedViewEntity entity) {
        return MaterializedViewResponse.builder()
                .name(entity.getName())
                .schema("public")
                .baseSql(entity.getDefinition())
                .refreshMode(entity.getRefreshStrategy())
                .status(entity.getStatus())
                .rowCount(0L)
                .sizeBytes(0L)
                .lastRefreshedAt(entity.getLastRefreshedAt())
                .baseTables(entity.getBaseTable() != null ? List.of(entity.getBaseTable()) : Collections.emptyList())
                .build();
    }
}
