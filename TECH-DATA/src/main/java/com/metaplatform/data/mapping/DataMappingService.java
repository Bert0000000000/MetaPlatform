package com.metaplatform.data.mapping;

import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.DataMappingEntity;
import com.metaplatform.data.entity.DataMappingExecutionEntity;
import com.metaplatform.data.entity.DataMappingFieldEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.mapping.dto.AutoDiscoverRequest;
import com.metaplatform.data.mapping.dto.AutoDiscoverResponse;
import com.metaplatform.data.mapping.dto.CreateDataMappingRequest;
import com.metaplatform.data.mapping.dto.CreateMappingFieldRequest;
import com.metaplatform.data.mapping.dto.DataMappingResponse;
import com.metaplatform.data.mapping.dto.MappingExecutionResponse;
import com.metaplatform.data.mapping.dto.MappingFieldResponse;
import com.metaplatform.data.mapping.dto.MappingValidationResult;
import com.metaplatform.data.mapping.dto.UpdateDataMappingRequest;
import com.metaplatform.data.mapping.dto.UpdateMappingFieldRequest;
import com.metaplatform.data.repository.DataMappingExecutionRepository;
import com.metaplatform.data.repository.DataMappingFieldRepository;
import com.metaplatform.data.repository.DataMappingRepository;
import com.metaplatform.data.schema.SchemaDiscoveryService;
import com.metaplatform.data.schema.dto.ColumnListResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * 数据映射服务：外部数据源字段 → Ontology 实体属性的映射管理（PRD REQ-3.2.2）。
 *
 * <p>提供映射 CRUD、字段映射管理、映射执行、校验与自动发现能力。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataMappingService {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";
    private static final Set<String> ALLOWED_STATUS = Set.of(STATUS_DRAFT, STATUS_ACTIVE, STATUS_INACTIVE);

    private static final String SYNC_MANUAL = "MANUAL";
    private static final String SYNC_SCHEDULED = "SCHEDULED";
    private static final String SYNC_REALTIME = "REALTIME";
    private static final Set<String> ALLOWED_SYNC_MODE = Set.of(SYNC_MANUAL, SYNC_SCHEDULED, SYNC_REALTIME);

    private static final String EXEC_RUNNING = "RUNNING";
    private static final String EXEC_SUCCESS = "SUCCESS";
    private static final String EXEC_FAILED = "FAILED";

    private static final Map<String, Set<String>> TYPE_COMPATIBILITY = Map.of(
            "STRING", Set.of("STRING", "TEXT", "VARCHAR", "CHAR"),
            "INTEGER", Set.of("INTEGER", "INT", "LONG", "BIGINT", "NUMBER"),
            "LONG", Set.of("LONG", "BIGINT", "INTEGER", "INT", "NUMBER"),
            "DOUBLE", Set.of("DOUBLE", "FLOAT", "DECIMAL", "NUMBER"),
            "BOOLEAN", Set.of("BOOLEAN", "BOOL", "BIT"),
            "DATE", Set.of("DATE", "DATETIME", "TIMESTAMP"),
            "DATETIME", Set.of("DATETIME", "TIMESTAMP", "DATE")
    );

    private final DataMappingRepository mappingRepository;
    private final DataMappingFieldRepository fieldRepository;
    private final DataMappingExecutionRepository executionRepository;
    private final SchemaDiscoveryService schemaDiscoveryService;

    // =====================================================================
    // 映射 CRUD
    // =====================================================================

    @Transactional
    public DataMappingResponse create(CreateDataMappingRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String status = request.status() != null ? request.status() : STATUS_DRAFT;
        String syncMode = request.syncMode() != null ? request.syncMode() : SYNC_MANUAL;
        validateStatus(status);
        validateSyncMode(syncMode);
        validateCronIfNeeded(syncMode, request.cronExpression());

        if (mappingRepository.existsByTenantIdAndName(tenantId, request.name())) {
            throw DataException.mappingNameDuplicate(request.name());
        }

        DataMappingEntity entity = new DataMappingEntity();
        entity.setId(newMappingId());
        entity.setTenantId(tenantId);
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setDatasourceId(request.datasourceId());
        entity.setSourceTable(request.sourceTable());
        entity.setOntologyEntityId(request.ontologyEntityId());
        entity.setStatus(status);
        entity.setSyncMode(syncMode);
        entity.setCronExpression(syncMode.equals(SYNC_SCHEDULED) ? request.cronExpression() : null);

        DataMappingEntity saved = mappingRepository.save(entity);
        log.info("数据映射创建 | tenant={} id={} name={}", tenantId, saved.getId(), saved.getName());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<DataMappingResponse> list(String datasourceId, String ontologyEntityId,
                                                   String status, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<DataMappingEntity> result = mappingRepository.search(
                tenantId,
                isBlank(datasourceId) ? null : datasourceId,
                isBlank(ontologyEntityId) ? null : ontologyEntityId,
                isBlank(status) ? null : status,
                pageable);

        return PageResponse.of(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    @Transactional(readOnly = true)
    public DataMappingResponse get(String mappingId) {
        return toResponse(requireMapping(mappingId));
    }

    @Transactional
    public DataMappingResponse update(String mappingId, UpdateDataMappingRequest request) {
        DataMappingEntity entity = requireMapping(mappingId);

        if (!isBlank(request.name()) && !entity.getName().equals(request.name())) {
            if (mappingRepository.existsByTenantIdAndName(entity.getTenantId(), request.name())) {
                throw DataException.mappingNameDuplicate(request.name());
            }
            entity.setName(request.name());
        }
        if (request.description() != null) {
            entity.setDescription(request.description());
        }
        if (!isBlank(request.status())) {
            validateStatus(request.status());
            entity.setStatus(request.status());
        }
        if (!isBlank(request.syncMode())) {
            validateSyncMode(request.syncMode());
            entity.setSyncMode(request.syncMode());
        }
        if (request.cronExpression() != null) {
            validateCronIfNeeded(entity.getSyncMode(), request.cronExpression());
            entity.setCronExpression(request.cronExpression());
        }

        DataMappingEntity saved = mappingRepository.save(entity);
        log.info("数据映射更新 | id={} name={}", saved.getId(), saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public boolean delete(String mappingId) {
        DataMappingEntity entity = requireMapping(mappingId);
        String tenantId = entity.getTenantId();
        // 级联清理字段映射
        fieldRepository.deleteByTenantIdAndMappingId(tenantId, mappingId);
        mappingRepository.delete(entity);
        log.info("数据映射删除 | id={}", mappingId);
        return true;
    }

    // =====================================================================
    // 字段映射管理
    // =====================================================================

    @Transactional(readOnly = true)
    public List<MappingFieldResponse> listFields(String mappingId) {
        DataMappingEntity mapping = requireMapping(mappingId);
        List<DataMappingFieldEntity> fields = fieldRepository
                .findByTenantIdAndMappingIdOrderByCreatedAtAsc(mapping.getTenantId(), mappingId);
        return fields.stream().map(this::toFieldResponse).toList();
    }

    @Transactional
    public MappingFieldResponse addField(String mappingId, CreateMappingFieldRequest request) {
        DataMappingEntity mapping = requireMapping(mappingId);

        DataMappingFieldEntity field = new DataMappingFieldEntity();
        field.setId(newFieldId());
        field.setTenantId(mapping.getTenantId());
        field.setMappingId(mappingId);
        field.setSourceField(request.sourceField());
        field.setSourceType(request.sourceType());
        field.setOntologyAttribute(request.ontologyAttribute());
        field.setTargetType(request.targetType());
        field.setTransformExpression(request.transformExpression());
        field.setIsRequired(request.isRequired() != null ? request.isRequired() : Boolean.FALSE);

        DataMappingFieldEntity saved = fieldRepository.save(field);
        log.info("字段映射添加 | mapping={} field={} source={} -> attr={}",
                mappingId, saved.getId(), saved.getSourceField(), saved.getOntologyAttribute());
        return toFieldResponse(saved);
    }

    @Transactional
    public MappingFieldResponse updateField(String mappingId, String fieldId, UpdateMappingFieldRequest request) {
        requireMapping(mappingId);
        DataMappingFieldEntity field = requireField(fieldId);
        if (!field.getMappingId().equals(mappingId)) {
            throw DataException.mappingFieldNotFound(fieldId);
        }

        if (!isBlank(request.sourceField())) {
            field.setSourceField(request.sourceField());
        }
        if (!isBlank(request.sourceType())) {
            field.setSourceType(request.sourceType());
        }
        if (!isBlank(request.ontologyAttribute())) {
            field.setOntologyAttribute(request.ontologyAttribute());
        }
        if (!isBlank(request.targetType())) {
            field.setTargetType(request.targetType());
        }
        if (request.transformExpression() != null) {
            field.setTransformExpression(request.transformExpression());
        }
        if (request.isRequired() != null) {
            field.setIsRequired(request.isRequired());
        }

        DataMappingFieldEntity saved = fieldRepository.save(field);
        log.info("字段映射更新 | mapping={} field={}", mappingId, fieldId);
        return toFieldResponse(saved);
    }

    @Transactional
    public boolean deleteField(String mappingId, String fieldId) {
        requireMapping(mappingId);
        DataMappingFieldEntity field = requireField(fieldId);
        if (!field.getMappingId().equals(mappingId)) {
            throw DataException.mappingFieldNotFound(fieldId);
        }
        fieldRepository.delete(field);
        log.info("字段映射删除 | mapping={} field={}", mappingId, fieldId);
        return true;
    }

    // =====================================================================
    // 映射执行
    // =====================================================================

    /**
     * 执行映射同步：从数据源拉取数据并写入 Ontology 实体。
     *
     * <p>骨架实现：创建执行记录，标记为 RUNNING 后立即完成（0 条记录）。
     * 真实数据拉取与 Ontology 写入待 TECH-ONT 接入后补齐。</p>
     */
    @Transactional
    public MappingExecutionResponse execute(String mappingId) {
        DataMappingEntity mapping = requireMapping(mappingId);
        if (STATUS_INACTIVE.equals(mapping.getStatus())) {
            throw DataException.invalidParam("映射已停用，不可执行: " + mappingId);
        }

        OffsetDateTime now = OffsetDateTime.now();
        DataMappingExecutionEntity exec = new DataMappingExecutionEntity();
        exec.setId(newExecutionId());
        exec.setTenantId(mapping.getTenantId());
        exec.setMappingId(mappingId);
        exec.setStatus(EXEC_RUNNING);
        exec.setRecordsProcessed(0L);
        exec.setRecordsFailed(0L);
        exec.setStartedAt(now);
        executionRepository.save(exec);

        // 骨架：真实同步逻辑待接入 TECH-ONT / Spring Batch 后实现
        OffsetDateTime finishedAt = OffsetDateTime.now();
        exec.setStatus(EXEC_SUCCESS);
        exec.setFinishedAt(finishedAt);
        executionRepository.save(exec);
        log.info("映射执行完成（骨架）| mapping={} exec={} status={}", mappingId, exec.getId(), exec.getStatus());
        return toExecutionResponse(exec);
    }

    @Transactional(readOnly = true)
    public PageResponse<MappingExecutionResponse> listExecutions(String mappingId, int page, int pageSize) {
        DataMappingEntity mapping = requireMapping(mappingId);
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "startedAt"));
        Page<DataMappingExecutionEntity> result = executionRepository
                .findByTenantIdAndMappingIdOrderByStartedAtDesc(mapping.getTenantId(), mappingId, pageable);
        return PageResponse.of(
                result.getContent().stream().map(this::toExecutionResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    /**
     * 校验映射：检查字段类型兼容性。
     */
    @Transactional(readOnly = true)
    public MappingValidationResult validate(String mappingId) {
        DataMappingEntity mapping = requireMapping(mappingId);
        List<DataMappingFieldEntity> fields = fieldRepository
                .findByTenantIdAndMappingIdOrderByCreatedAtAsc(mapping.getTenantId(), mappingId);

        List<MappingValidationResult.FieldValidationIssue> issues = new ArrayList<>();
        int valid = 0;
        for (DataMappingFieldEntity field : fields) {
            Optional<String> reason = checkTypeCompatibility(field.getSourceType(), field.getTargetType());
            if (reason.isPresent()) {
                issues.add(new MappingValidationResult.FieldValidationIssue(
                        field.getId(), field.getSourceField(), field.getOntologyAttribute(),
                        field.getSourceType(), field.getTargetType(), reason.get()));
            } else {
                valid++;
            }
        }
        boolean allValid = issues.isEmpty() && !fields.isEmpty();
        return new MappingValidationResult(allValid, fields.size(), valid, issues.size(), issues);
    }

    // =====================================================================
    // 自动发现
    // =====================================================================

    /**
     * 根据数据源 schema 自动推荐字段映射。
     *
     * <p>调用 {@link SchemaDiscoveryService#listColumns} 获取表的列信息，
     * 按列名与 Ontology 属性名匹配生成推荐。</p>
     */
    @Transactional(readOnly = true)
    public AutoDiscoverResponse autoDiscover(AutoDiscoverRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String[] parts = splitTableReference(request.sourceTable());
        String database = parts[0];
        String table = parts[1];

        List<MappingFieldResponse> recommended = new ArrayList<>();
        try {
            ColumnListResponse columns = schemaDiscoveryService.listColumns(
                    request.datasourceId(), database, table);
            for (ColumnListResponse.ColumnInfo column : columns.getColumns()) {
                String targetType = mapType(column.getDataType());
                recommended.add(new MappingFieldResponse(
                        null, null, column.getName(), column.getDataType(),
                        toCamelCase(column.getName()), targetType, null,
                        !column.isNullable(), null, null));
            }
        } catch (DataException e) {
            log.warn("自动发现 schema 获取失败 | ds={} table={} error={}",
                    request.datasourceId(), request.sourceTable(), e.getMessage());
        }
        log.info("自动发现完成 | tenant={} ds={} table={} recommended={}",
                tenantId, request.datasourceId(), request.sourceTable(), recommended.size());
        return new AutoDiscoverResponse(
                request.datasourceId(), request.sourceTable(),
                request.ontologyEntityId(), recommended);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private DataMappingEntity requireMapping(String mappingId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return mappingRepository.findByIdAndTenantId(mappingId, tenantId)
                .orElseThrow(() -> DataException.mappingNotFound(mappingId));
    }

    private DataMappingFieldEntity requireField(String fieldId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return fieldRepository.findByIdAndTenantId(fieldId, tenantId)
                .orElseThrow(() -> DataException.mappingFieldNotFound(fieldId));
    }

    private void validateStatus(String status) {
        if (!ALLOWED_STATUS.contains(status)) {
            throw DataException.invalidParam("非法状态: " + status);
        }
    }

    private void validateSyncMode(String syncMode) {
        if (!ALLOWED_SYNC_MODE.contains(syncMode)) {
            throw DataException.invalidParam("非法同步模式: " + syncMode);
        }
    }

    private void validateCronIfNeeded(String syncMode, String cronExpression) {
        if (SYNC_SCHEDULED.equals(syncMode) && isBlank(cronExpression)) {
            throw DataException.invalidParam("定时同步模式必须提供 cronExpression");
        }
    }

    private Optional<String> checkTypeCompatibility(String sourceType, String targetType) {
        if (isBlank(sourceType) || isBlank(targetType)) {
            return Optional.of("类型不能为空");
        }
        String source = sourceType.toUpperCase();
        String target = targetType.toUpperCase();
        if (source.equals(target)) {
            return Optional.empty();
        }
        Set<String> compatible = TYPE_COMPATIBILITY.get(target);
        if (compatible != null && compatible.contains(source)) {
            return Optional.empty();
        }
        return Optional.of("类型不兼容: " + sourceType + " -> " + targetType);
    }

    private String mapType(String jdbcType) {
        if (jdbcType == null) {
            return "STRING";
        }
        String t = jdbcType.toUpperCase();
        if (t.contains("CHAR") || t.contains("TEXT") || t.contains("CLOB")) {
            return "STRING";
        }
        if (t.contains("INT") && !t.contains("BIGINT")) {
            return "INTEGER";
        }
        if (t.contains("BIGINT") || t.contains("LONG")) {
            return "LONG";
        }
        if (t.contains("FLOAT") || t.contains("DOUBLE") || t.contains("DECIMAL") || t.contains("NUMERIC")) {
            return "DOUBLE";
        }
        if (t.contains("BOOL") || t.contains("BIT")) {
            return "BOOLEAN";
        }
        if (t.contains("DATE") || t.contains("TIME")) {
            return "DATETIME";
        }
        return "STRING";
    }

    private String[] splitTableReference(String tableRef) {
        int dot = tableRef.indexOf('.');
        if (dot > 0) {
            return new String[]{tableRef.substring(0, dot), tableRef.substring(dot + 1)};
        }
        return new String[]{null, tableRef};
    }

    private String toCamelCase(String snake) {
        if (snake == null || snake.isEmpty()) {
            return snake;
        }
        StringBuilder sb = new StringBuilder();
        boolean nextUpper = false;
        for (char c : snake.toCharArray()) {
            if (c == '_' || c == '-') {
                nextUpper = true;
            } else if (nextUpper) {
                sb.append(Character.toUpperCase(c));
                nextUpper = false;
            } else {
                sb.append(Character.toLowerCase(c));
            }
        }
        return sb.toString();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private DataMappingResponse toResponse(DataMappingEntity entity) {
        return new DataMappingResponse(
                entity.getId(), entity.getName(), entity.getDescription(),
                entity.getDatasourceId(), entity.getSourceTable(), entity.getOntologyEntityId(),
                entity.getStatus(), entity.getSyncMode(), entity.getCronExpression(),
                entity.getCreatedAt(), entity.getUpdatedAt());
    }

    private MappingFieldResponse toFieldResponse(DataMappingFieldEntity entity) {
        return new MappingFieldResponse(
                entity.getId(), entity.getMappingId(), entity.getSourceField(),
                entity.getSourceType(), entity.getOntologyAttribute(), entity.getTargetType(),
                entity.getTransformExpression(), entity.getIsRequired(),
                entity.getCreatedAt(), entity.getUpdatedAt());
    }

    private MappingExecutionResponse toExecutionResponse(DataMappingExecutionEntity entity) {
        return new MappingExecutionResponse(
                entity.getId(), entity.getMappingId(), entity.getStatus(),
                entity.getRecordsProcessed(), entity.getRecordsFailed(),
                entity.getStartedAt(), entity.getFinishedAt(), entity.getErrorMessage());
    }

    private static String newMappingId() {
        return "map-" + UUID.randomUUID().toString().replace("-", "");
    }

    private static String newFieldId() {
        return "fld-" + UUID.randomUUID().toString().replace("-", "");
    }

    private static String newExecutionId() {
        return "mex-" + UUID.randomUUID().toString().replace("-", "");
    }
}
