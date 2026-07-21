package com.metaplatform.rule.decisiontable.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.decisiontable.dto.AddColumnRequest;
import com.metaplatform.rule.decisiontable.dto.CreateDecisionTableRequest;
import com.metaplatform.rule.decisiontable.dto.DecisionTableColumnDto;
import com.metaplatform.rule.decisiontable.dto.DecisionTableResponse;
import com.metaplatform.rule.decisiontable.dto.UpdateColumnRequest;
import com.metaplatform.rule.decisiontable.dto.UpdateDecisionTableRequest;
import com.metaplatform.rule.decisiontable.entity.DecisionTableEntity;
import com.metaplatform.rule.decisiontable.repository.DecisionTableRepository;
import com.metaplatform.rule.exception.RuleException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DecisionTableService {

    private static final List<String> VALID_HIT_POLICIES = List.of("FIRST", "ALL", "PRIORITY");
    private static final String TYPE_INPUT = "INPUT";
    private static final String TYPE_OUTPUT = "OUTPUT";

    private final DecisionTableRepository decisionTableRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public DecisionTableResponse create(CreateDecisionTableRequest request) {
        String tenantId = TenantContext.get();
        String hitPolicy = StringUtils.hasText(request.getHitPolicy()) ? request.getHitPolicy().toUpperCase() : "FIRST";
        validateHitPolicy(hitPolicy);

        if (decisionTableRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new RuleException(ErrorCode.DECISION_TABLE_ALREADY_EXISTS);
        }

        List<DecisionTableColumnDto> inputCols = request.getInputColumns() != null ? request.getInputColumns() : List.of();
        List<DecisionTableColumnDto> outputCols = request.getOutputColumns() != null ? request.getOutputColumns() : List.of();
        assignColumnIds(inputCols, TYPE_INPUT);
        assignColumnIds(outputCols, TYPE_OUTPUT);

        DecisionTableEntity entity = DecisionTableEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .rulesetId(request.getRulesetId())
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .hitPolicy(hitPolicy)
                .inputColumns(writeJson(inputCols))
                .outputColumns(writeJson(outputCols))
                .status("DRAFT")
                .version(1)
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();

        DecisionTableEntity saved = decisionTableRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<DecisionTableResponse> list(int page, int pageSize) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<DecisionTableEntity> result =
                decisionTableRepository.findByTenantIdAndDeletedAtIsNull(tenantId, pageRequest);

        return PageResponse.<DecisionTableResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public DecisionTableResponse getById(String id) {
        return toResponse(findById(id));
    }

    @Transactional
    public DecisionTableResponse update(String id, UpdateDecisionTableRequest request) {
        DecisionTableEntity entity = findById(id);

        if (StringUtils.hasText(request.getName())) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (StringUtils.hasText(request.getHitPolicy())) {
            String hitPolicy = request.getHitPolicy().toUpperCase();
            validateHitPolicy(hitPolicy);
            entity.setHitPolicy(hitPolicy);
        }
        if (StringUtils.hasText(request.getStatus())) {
            entity.setStatus(request.getStatus().toUpperCase());
        }
        if (request.getInputColumns() != null) {
            assignColumnIds(request.getInputColumns(), TYPE_INPUT);
            entity.setInputColumns(writeJson(request.getInputColumns()));
        }
        if (request.getOutputColumns() != null) {
            assignColumnIds(request.getOutputColumns(), TYPE_OUTPUT);
            entity.setOutputColumns(writeJson(request.getOutputColumns()));
        }
        entity.setUpdatedBy(TenantContext.getUserId());

        DecisionTableEntity saved = decisionTableRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        DecisionTableEntity entity = findById(id);
        entity.setDeletedAt(java.time.Instant.now());
        entity.setUpdatedBy(TenantContext.getUserId());
        decisionTableRepository.save(entity);
    }

    // ════════════════════════════════════════════
    // P1-RULE-07: Column management
    // ════════════════════════════════════════════

    @Transactional
    public DecisionTableResponse addColumn(String id, AddColumnRequest request) {
        DecisionTableEntity entity = findById(id);
        String columnType = request.getColumnType().toUpperCase();

        DecisionTableColumnDto column = DecisionTableColumnDto.builder()
                .id(UUID.randomUUID().toString())
                .name(request.getName())
                .field(request.getField())
                .dataType(request.getDataType())
                .expression(request.getExpression())
                .columnType(columnType)
                .build();

        if (TYPE_INPUT.equals(columnType)) {
            List<DecisionTableColumnDto> cols = readJson(entity.getInputColumns());
            cols.add(column);
            entity.setInputColumns(writeJson(cols));
        } else if (TYPE_OUTPUT.equals(columnType)) {
            List<DecisionTableColumnDto> cols = readJson(entity.getOutputColumns());
            cols.add(column);
            entity.setOutputColumns(writeJson(cols));
        } else {
            throw new RuleException(ErrorCode.INVALID_PARAM, "columnType 必须为 INPUT 或 OUTPUT");
        }
        entity.setUpdatedBy(TenantContext.getUserId());
        return toResponse(decisionTableRepository.save(entity));
    }

    @Transactional
    public DecisionTableResponse updateColumn(String id, String colId, UpdateColumnRequest request) {
        DecisionTableEntity entity = findById(id);

        boolean updated = updateColumnInList(entity, TYPE_INPUT, colId, request);
        if (!updated) {
            updated = updateColumnInList(entity, TYPE_OUTPUT, colId, request);
        }
        if (!updated) {
            throw new RuleException(ErrorCode.COLUMN_NOT_FOUND);
        }
        entity.setUpdatedBy(TenantContext.getUserId());
        return toResponse(decisionTableRepository.save(entity));
    }

    @Transactional
    public DecisionTableResponse removeColumn(String id, String colId) {
        DecisionTableEntity entity = findById(id);

        boolean removed = removeColumnFromList(entity, TYPE_INPUT, colId);
        if (!removed) {
            removed = removeColumnFromList(entity, TYPE_OUTPUT, colId);
        }
        if (!removed) {
            throw new RuleException(ErrorCode.COLUMN_NOT_FOUND);
        }
        entity.setUpdatedBy(TenantContext.getUserId());
        return toResponse(decisionTableRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public DecisionTableEntity getEntity(String id) {
        return findById(id);
    }

    // ════════════════════════════════════════════
    // Helpers
    // ════════════════════════════════════════════

    private DecisionTableEntity findById(String id) {
        String tenantId = TenantContext.get();
        DecisionTableEntity entity = decisionTableRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new RuleException(ErrorCode.DECISION_TABLE_NOT_FOUND));
        if (!tenantId.equals(entity.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }
        return entity;
    }

    private boolean updateColumnInList(DecisionTableEntity entity, String type, String colId,
                                        UpdateColumnRequest request) {
        String json = TYPE_INPUT.equals(type) ? entity.getInputColumns() : entity.getOutputColumns();
        List<DecisionTableColumnDto> cols = readJson(json);
        boolean found = false;
        for (DecisionTableColumnDto col : cols) {
            if (colId.equals(col.getId())) {
                if (request.getName() != null) col.setName(request.getName());
                if (request.getField() != null) col.setField(request.getField());
                if (request.getDataType() != null) col.setDataType(request.getDataType());
                if (request.getExpression() != null) col.setExpression(request.getExpression());
                found = true;
                break;
            }
        }
        if (found) {
            if (TYPE_INPUT.equals(type)) {
                entity.setInputColumns(writeJson(cols));
            } else {
                entity.setOutputColumns(writeJson(cols));
            }
        }
        return found;
    }

    private boolean removeColumnFromList(DecisionTableEntity entity, String type, String colId) {
        String json = TYPE_INPUT.equals(type) ? entity.getInputColumns() : entity.getOutputColumns();
        List<DecisionTableColumnDto> cols = readJson(json);
        boolean removed = cols.removeIf(col -> colId.equals(col.getId()));
        if (removed) {
            if (TYPE_INPUT.equals(type)) {
                entity.setInputColumns(writeJson(cols));
            } else {
                entity.setOutputColumns(writeJson(cols));
            }
        }
        return removed;
    }

    private void validateHitPolicy(String hitPolicy) {
        if (!VALID_HIT_POLICIES.contains(hitPolicy)) {
            throw new RuleException(ErrorCode.INVALID_PARAM, "hitPolicy 必须为 FIRST、ALL 或 PRIORITY");
        }
    }

    private void assignColumnIds(List<DecisionTableColumnDto> columns, String columnType) {
        for (DecisionTableColumnDto col : columns) {
            if (!StringUtils.hasText(col.getId())) {
                col.setId(UUID.randomUUID().toString());
            }
            col.setColumnType(columnType);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new RuleException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败: " + e.getMessage());
        }
    }

    private List<DecisionTableColumnDto> readJson(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse decision table columns JSON: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private DecisionTableResponse toResponse(DecisionTableEntity entity) {
        List<DecisionTableColumnDto> inputCols = readJson(entity.getInputColumns());
        List<DecisionTableColumnDto> outputCols = readJson(entity.getOutputColumns());

        // V11-03：合并 columns，便于前端直接消费
        List<DecisionTableColumnDto> allColumns = new ArrayList<>(inputCols.size() + outputCols.size());
        allColumns.addAll(inputCols);
        allColumns.addAll(outputCols);

        return DecisionTableResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .rulesetId(entity.getRulesetId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .hitPolicy(entity.getHitPolicy())
                .inputColumns(inputCols)
                .outputColumns(outputCols)
                .columns(allColumns)
                .status(entity.getStatus())
                // status != ARCHIVED 视为启用
                .enabled(!"ARCHIVED".equalsIgnoreCase(entity.getStatus()))
                // V1.1 阶段 conceptId 暂用 rulesetId 兼容，V1.2 阶段由 Ontology 关联表填充
                .conceptId(entity.getRulesetId())
                .version(entity.getVersion())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }
}
