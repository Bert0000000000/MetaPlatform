package com.metaplatform.rule.decisiontable.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.decisiontable.dto.AddRowRequest;
import com.metaplatform.rule.decisiontable.dto.BatchImportRowsRequest;
import com.metaplatform.rule.decisiontable.dto.DecisionTableColumnDto;
import com.metaplatform.rule.decisiontable.dto.DecisionTableRowResponse;
import com.metaplatform.rule.decisiontable.dto.UpdateRowRequest;
import com.metaplatform.rule.decisiontable.dto.ValidationResultDto;
import com.metaplatform.rule.decisiontable.entity.DecisionTableEntity;
import com.metaplatform.rule.decisiontable.entity.DecisionTableRowEntity;
import com.metaplatform.rule.decisiontable.repository.DecisionTableRowRepository;
import com.metaplatform.rule.exception.RuleException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DecisionTableRowService {

    private final DecisionTableRowRepository rowRepository;
    private final DecisionTableService decisionTableService;
    private final ObjectMapper objectMapper;

    @Transactional
    public DecisionTableRowResponse addRow(String tableId, AddRowRequest request) {
        DecisionTableEntity table = decisionTableService.getEntity(tableId);
        String tenantId = TenantContext.get();

        int order = request.getRowOrder() != null ? request.getRowOrder()
                : (int) rowRepository.countByTableId(tableId);

        DecisionTableRowEntity entity = DecisionTableRowEntity.builder()
                .id(UUID.randomUUID().toString())
                .tableId(tableId)
                .tenantId(tenantId)
                .rowOrder(order)
                .inputValues(writeJson(request.getInputValues()))
                .outputValues(writeJson(request.getOutputValues()))
                .enabled(request.getEnabled() != null ? request.getEnabled() : true)
                .build();

        return toResponse(rowRepository.save(entity));
    }

    @Transactional
    public List<DecisionTableRowResponse> batchImport(String tableId, BatchImportRowsRequest request) {
        DecisionTableEntity table = decisionTableService.getEntity(tableId);
        String tenantId = TenantContext.get();

        List<DecisionTableRowResponse> results = new ArrayList<>();
        int baseOrder = (int) rowRepository.countByTableId(tableId);
        int idx = 0;
        for (AddRowRequest row : request.getRows()) {
            int order = row.getRowOrder() != null ? row.getRowOrder() : baseOrder + idx;
            DecisionTableRowEntity entity = DecisionTableRowEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tableId(tableId)
                    .tenantId(tenantId)
                    .rowOrder(order)
                    .inputValues(writeJson(row.getInputValues()))
                    .outputValues(writeJson(row.getOutputValues()))
                    .enabled(row.getEnabled() != null ? row.getEnabled() : true)
                    .build();
            results.add(toResponse(rowRepository.save(entity)));
            idx++;
        }
        return results;
    }

    @Transactional(readOnly = true)
    public List<DecisionTableRowResponse> listRows(String tableId) {
        decisionTableService.getEntity(tableId);
        return rowRepository.findByTableIdOrderByRowOrderAsc(tableId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public DecisionTableRowResponse updateRow(String tableId, String rowId, UpdateRowRequest request) {
        DecisionTableRowEntity entity = findRow(tableId, rowId);
        if (request.getRowOrder() != null) entity.setRowOrder(request.getRowOrder());
        if (request.getInputValues() != null) entity.setInputValues(writeJson(request.getInputValues()));
        if (request.getOutputValues() != null) entity.setOutputValues(writeJson(request.getOutputValues()));
        if (request.getEnabled() != null) entity.setEnabled(request.getEnabled());
        return toResponse(rowRepository.save(entity));
    }

    @Transactional
    public void deleteRow(String tableId, String rowId) {
        DecisionTableRowEntity entity = findRow(tableId, rowId);
        rowRepository.delete(entity);
    }

    @Transactional(readOnly = true)
    public ValidationResultDto validate(String tableId) {
        DecisionTableEntity table = decisionTableService.getEntity(tableId);
        List<DecisionTableColumnDto> inputCols = readColumns(table.getInputColumns());
        List<DecisionTableColumnDto> outputCols = readColumns(table.getOutputColumns());
        List<DecisionTableRowEntity> rows = rowRepository.findByTableIdOrderByRowOrderAsc(tableId);

        List<ValidationResultDto.RowValidationError> errors = new ArrayList<>();
        for (DecisionTableRowEntity row : rows) {
            Map<String, Object> inputs = readMap(row.getInputValues());
            Map<String, Object> outputs = readMap(row.getOutputValues());
            // Validate input values contain all required input fields
            for (DecisionTableColumnDto col : inputCols) {
                if (col.getField() != null && !inputs.containsKey(col.getField())) {
                    errors.add(ValidationResultDto.RowValidationError.builder()
                            .rowId(row.getId())
                            .rowOrder(row.getRowOrder())
                            .field(col.getField())
                            .message("缺少输入列: " + col.getName())
                            .build());
                }
            }
            // Validate output values contain all output fields
            for (DecisionTableColumnDto col : outputCols) {
                if (col.getField() != null && !outputs.containsKey(col.getField())) {
                    errors.add(ValidationResultDto.RowValidationError.builder()
                            .rowId(row.getId())
                            .rowOrder(row.getRowOrder())
                            .field(col.getField())
                            .message("缺少输出列: " + col.getName())
                            .build());
                }
            }
        }

        int invalid = errors.size();
        int valid = rows.size() - (int) errors.stream().map(ValidationResultDto.RowValidationError::getRowId).distinct().count();
        return ValidationResultDto.builder()
                .valid(errors.isEmpty())
                .totalRows(rows.size())
                .validRows(valid)
                .invalidRows(rows.size() - valid)
                .errors(errors)
                .build();
    }

    @Transactional(readOnly = true)
    public DecisionTableEntity getTable(String tableId) {
        return decisionTableService.getEntity(tableId);
    }

    @Transactional(readOnly = true)
    public List<DecisionTableRowEntity> getEnabledRows(String tableId) {
        return rowRepository.findByTableIdOrderByRowOrderAsc(tableId).stream()
                .filter(DecisionTableRowEntity::getEnabled)
                .toList();
    }

    private DecisionTableRowEntity findRow(String tableId, String rowId) {
        return rowRepository.findByIdAndTableId(rowId, tableId)
                .orElseThrow(() -> new RuleException(ErrorCode.DECISION_TABLE_ROW_NOT_FOUND));
    }

    private List<DecisionTableColumnDto> readColumns(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new RuleException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败: " + e.getMessage());
        }
    }

    private DecisionTableRowResponse toResponse(DecisionTableRowEntity entity) {
        return DecisionTableRowResponse.builder()
                .id(entity.getId())
                .tableId(entity.getTableId())
                .rowOrder(entity.getRowOrder())
                .inputValues(readMap(entity.getInputValues()))
                .outputValues(readMap(entity.getOutputValues()))
                .enabled(entity.getEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
