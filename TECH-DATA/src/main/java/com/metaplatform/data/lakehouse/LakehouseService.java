package com.metaplatform.data.lakehouse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.IngestTaskEntity;
import com.metaplatform.data.entity.LakeTableEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.lakehouse.dto.CreateIngestTaskRequest;
import com.metaplatform.data.lakehouse.dto.CreateLakeTableRequest;
import com.metaplatform.data.lakehouse.dto.IngestTaskResponse;
import com.metaplatform.data.lakehouse.dto.LakeTableResponse;
import com.metaplatform.data.repository.IngestTaskRepository;
import com.metaplatform.data.repository.LakeTableRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Example;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * 数据湖服务：表 CRUD + 摄入任务 CRUD + 触发执行。
 *
 * <p>对应 Python app/lakehouse/service.py 的 LakehouseService。</p>
 *
 * <p>持久化存储（lake_table / ingest_task 表）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LakehouseService {

    private final ObjectMapper objectMapper;
    private final LakeTableRepository lakeTableRepository;
    private final IngestTaskRepository ingestTaskRepository;

    /**
     * 创建数据湖表。
     */
    @Transactional
    public LakeTableResponse createTable(CreateLakeTableRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        if (lakeTableRepository.existsByTenantIdAndDatabaseNameAndTableNameAndFormat(
                tenantId, request.getDatabase(), request.getName(), request.getFormat())) {
            throw new DataException(ErrorCode.LAKE_TABLE_DUPLICATE,
                    "数据湖表已存在: " + request.getDatabase() + "." + request.getName());
        }
        String tableId = "lake-" + UUID.randomUUID().toString().replace("-", "");
        LakeTableEntity entity = new LakeTableEntity();
        entity.setId(tableId);
        entity.setTenantId(tenantId);
        entity.setDatabaseName(request.getDatabase());
        entity.setTableName(request.getName());
        entity.setFormat(request.getFormat());
        entity.setDescription(request.getDescription());
        entity.setSchemaJson(serializeJson(request.getSchema()));
        entity.setProperties(serializeJson(request.getPartitionSpec()));
        entity.setRecordCount(0L);
        entity.setSizeBytes(0L);
        entity.setLastModifiedAt(OffsetDateTime.now());

        LakeTableEntity saved = lakeTableRepository.save(entity);
        log.info("数据湖表创建 | tenant={} id={} name={} format={}",
                tenantId, tableId, request.getName(), request.getFormat());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<LakeTableResponse> listTables(String database, String format, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        LakeTableEntity probe = new LakeTableEntity();
        probe.setTenantId(tenantId);
        if (format != null && !format.isBlank()) {
            probe.setFormat(format);
        }
        if (database != null && !database.isBlank()) {
            probe.setDatabaseName(database);
        }
        Page<LakeTableEntity> result = lakeTableRepository.findAll(Example.of(probe), pageable);

        return PageResponse.of(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    @Transactional(readOnly = true)
    public LakeTableResponse getTable(String tableId) {
        return toResponse(requireTable(tableId));
    }

    @Transactional
    public boolean deleteTable(String tableId) {
        LakeTableEntity entity = requireTable(tableId);
        lakeTableRepository.delete(entity);
        log.info("数据湖表删除 | id={}", tableId);
        return true;
    }

    /**
     * 创建摄入任务。
     */
    @Transactional
    public IngestTaskResponse createIngestTask(CreateIngestTaskRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        requireTable(request.getTargetTableId());
        String taskId = "ingest-" + UUID.randomUUID().toString().replace("-", "");
        IngestTaskEntity entity = new IngestTaskEntity();
        entity.setId(taskId);
        entity.setTenantId(tenantId);
        entity.setName(request.getSourceTable() != null ? request.getSourceTable()
                : "ingest-" + request.getTargetTableId());
        entity.setSourceDsId(request.getSourceDatasourceId());
        entity.setTargetTableId(request.getTargetTableId());
        entity.setMode(request.getMode());
        entity.setScheduleCron(request.getSchedule());
        entity.setStatus("ACTIVE");

        IngestTaskEntity saved = ingestTaskRepository.save(entity);
        log.info("摄入任务创建 | tenant={} id={} target={}", tenantId, taskId, request.getTargetTableId());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<IngestTaskResponse> listIngestTasks(String targetTableId, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        IngestTaskEntity probe = new IngestTaskEntity();
        probe.setTenantId(tenantId);
        if (targetTableId != null && !targetTableId.isBlank()) {
            probe.setTargetTableId(targetTableId);
        }
        Page<IngestTaskEntity> result = ingestTaskRepository.findAll(Example.of(probe), pageable);

        return PageResponse.of(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    @Transactional
    public boolean deleteIngestTask(String taskId) {
        IngestTaskEntity entity = requireIngestTask(taskId);
        ingestTaskRepository.delete(entity);
        return true;
    }

    /**
     * 触发摄入任务执行（stub：真实 Hudi/Iceberg 集成由外部 subagent 处理）。
     */
    @Transactional
    public IngestTaskResponse runIngestTask(String taskId) {
        IngestTaskEntity entity = requireIngestTask(taskId);
        entity.setLastRunAt(OffsetDateTime.now());
        entity.setLastRunStatus("SUCCESS");
        entity.setLastRunRows(0L);
        IngestTaskEntity saved = ingestTaskRepository.save(entity);
        log.info("摄入任务触发 | id={} status=SUCCESS", taskId);
        return toResponse(saved);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private LakeTableEntity requireTable(String tableId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return lakeTableRepository.findByIdAndTenantId(tableId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.LAKE_TABLE_NOT_FOUND, "数据湖表不存在: " + tableId));
    }

    private IngestTaskEntity requireIngestTask(String taskId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ingestTaskRepository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.ETL_TASK_NOT_FOUND, "摄入任务不存在: " + taskId));
    }

    private LakeTableResponse toResponse(LakeTableEntity entity) {
        return LakeTableResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getTableName())
                .database(entity.getDatabaseName())
                .format(entity.getFormat())
                .description(entity.getDescription())
                .schema(parseJson(entity.getSchemaJson()))
                .partitionSpec(parseJson(entity.getProperties()))
                .rowCount(entity.getRecordCount() != null ? entity.getRecordCount() : 0L)
                .sizeBytes(entity.getSizeBytes() != null ? entity.getSizeBytes() : 0L)
                .status("ACTIVE")
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private IngestTaskResponse toResponse(IngestTaskEntity entity) {
        return IngestTaskResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .sourceDatasourceId(entity.getSourceDsId())
                .targetTableId(entity.getTargetTableId())
                .sourceTable(entity.getName())
                .mode(entity.getMode())
                .config(objectMapper.createObjectNode())
                .schedule(entity.getScheduleCron())
                .status(entity.getStatus())
                .lastRunAt(entity.getLastRunAt())
                .lastRunStatus(entity.getLastRunStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String serializeJson(Map<String, Object> map) {
        if (map == null) return null;
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return null;
        }
    }

    private JsonNode parseJson(String json) {
        if (json == null || json.isBlank()) return objectMapper.createObjectNode();
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }
}
