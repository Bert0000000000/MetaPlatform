package com.metaplatform.rule.decisiontable.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.decisiontable.dto.AddColumnRequest;
import com.metaplatform.rule.decisiontable.dto.AddRowRequest;
import com.metaplatform.rule.decisiontable.dto.BatchImportRowsRequest;
import com.metaplatform.rule.decisiontable.dto.CreateDecisionTableRequest;
import com.metaplatform.rule.decisiontable.dto.DecisionTableExecutionResultDto;
import com.metaplatform.rule.decisiontable.dto.DecisionTableRowResponse;
import com.metaplatform.rule.decisiontable.dto.DecisionTableResponse;
import com.metaplatform.rule.decisiontable.dto.UpdateColumnRequest;
import com.metaplatform.rule.decisiontable.dto.UpdateDecisionTableRequest;
import com.metaplatform.rule.decisiontable.dto.UpdateRowRequest;
import com.metaplatform.rule.decisiontable.dto.ValidationResultDto;
import com.metaplatform.rule.decisiontable.entity.DecisionTableEntity;
import com.metaplatform.rule.decisiontable.entity.DecisionTableRowEntity;
import com.metaplatform.rule.decisiontable.service.DecisionTableRowService;
import com.metaplatform.rule.decisiontable.service.DecisionTableService;
import com.metaplatform.rule.testing.dto.RuleTestRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/rule/decision-tables")
@RequiredArgsConstructor
public class DecisionTableController {

    private final DecisionTableService decisionTableService;
    private final DecisionTableRowService decisionTableRowService;

    @PostMapping
    public ApiResponse<DecisionTableResponse> create(@Valid @RequestBody CreateDecisionTableRequest request) {
        return ApiResponse.success(decisionTableService.create(request));
    }

    /**
     * V11-03：列表查询，聚合 rows 字段以便前端直接渲染整张表。
     *
     * <p>为了避免 N+1 查询开销，此处按需在响应中嵌入行数据。后续 V1.2 可加上
     * {@code includeRows} 查询参数控制是否返回。
     */
    @GetMapping
    public ApiResponse<PageResponse<DecisionTableResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        PageResponse<DecisionTableResponse> result = decisionTableService.list(page, pageSize);
        for (DecisionTableResponse resp : result.getItems()) {
            resp.setRows(decisionTableRowService.listRows(resp.getId()));
        }
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<DecisionTableResponse> get(@PathVariable String id) {
        DecisionTableResponse resp = decisionTableService.getById(id);
        resp.setRows(decisionTableRowService.listRows(id));
        return ApiResponse.success(resp);
    }

    @PutMapping("/{id}")
    public ApiResponse<DecisionTableResponse> update(@PathVariable String id,
                                                      @Valid @RequestBody UpdateDecisionTableRequest request) {
        return ApiResponse.success(decisionTableService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        decisionTableService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/columns")
    public ApiResponse<DecisionTableResponse> addColumn(@PathVariable String id,
                                                         @Valid @RequestBody AddColumnRequest request) {
        return ApiResponse.success(decisionTableService.addColumn(id, request));
    }

    @PutMapping("/{id}/columns/{colId}")
    public ApiResponse<DecisionTableResponse> updateColumn(@PathVariable String id,
                                                            @PathVariable String colId,
                                                            @Valid @RequestBody UpdateColumnRequest request) {
        return ApiResponse.success(decisionTableService.updateColumn(id, colId, request));
    }

    @DeleteMapping("/{id}/columns/{colId}")
    public ApiResponse<DecisionTableResponse> removeColumn(@PathVariable String id,
                                                            @PathVariable String colId) {
        return ApiResponse.success(decisionTableService.removeColumn(id, colId));
    }

    // ════════════════════════════════════════════
    // P1-RULE-08: Row management + validation + batch import
    // ════════════════════════════════════════════

    @PostMapping("/{id}/rows")
    public ApiResponse<DecisionTableRowResponse> addRow(@PathVariable String id,
                                                          @Valid @RequestBody AddRowRequest request) {
        return ApiResponse.success(decisionTableRowService.addRow(id, request));
    }

    @GetMapping("/{id}/rows")
    public ApiResponse<List<DecisionTableRowResponse>> listRows(@PathVariable String id) {
        return ApiResponse.success(decisionTableRowService.listRows(id));
    }

    @PutMapping("/{id}/rows/{rowId}")
    public ApiResponse<DecisionTableRowResponse> updateRow(@PathVariable String id,
                                                            @PathVariable String rowId,
                                                            @Valid @RequestBody UpdateRowRequest request) {
        return ApiResponse.success(decisionTableRowService.updateRow(id, rowId, request));
    }

    @DeleteMapping("/{id}/rows/{rowId}")
    public ApiResponse<Void> deleteRow(@PathVariable String id, @PathVariable String rowId) {
        decisionTableRowService.deleteRow(id, rowId);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/rows/batch")
    public ApiResponse<List<DecisionTableRowResponse>> batchImport(@PathVariable String id,
                                                                    @Valid @RequestBody BatchImportRowsRequest request) {
        return ApiResponse.success(decisionTableRowService.batchImport(id, request));
    }

    @PostMapping("/{id}/validate")
    public ApiResponse<ValidationResultDto> validate(@PathVariable String id) {
        return ApiResponse.success(decisionTableRowService.validate(id));
    }

    // ════════════════════════════════════════════
    // V11-03: 决策表执行端点
    // ════════════════════════════════════════════

    /**
     * 执行决策表，返回命中的行与输出。
     *
     * <p>路径与前端 {@code executeDecisionTable} 一致：{@code POST /v1/rule/decision-tables/{id}/execute}。
     * 入参为 {@link RuleTestRequest#getInputData()}，与 {@code /test} 端点共享 schema。
     */
    @PostMapping("/{id}/execute")
    public ApiResponse<DecisionTableExecutionResultDto> execute(
            @PathVariable String id,
            @Valid @RequestBody RuleTestRequest request) {
        DecisionTableEntity table = decisionTableService.getEntity(id);
        List<DecisionTableRowEntity> rows = decisionTableRowService.getEnabledRows(id);
        String hitPolicy = table.getHitPolicy() == null ? "FIRST" : table.getHitPolicy().toUpperCase();

        long start = System.currentTimeMillis();
        List<DecisionTableRowResponse> matchedRows = new ArrayList<>();
        List<Map<String, Object>> outputs = new ArrayList<>();

        for (DecisionTableRowEntity row : rows) {
            Map<String, Object> rowInputs = decisionTableRowService.readInputMap(row);
            if (matchesInput(request.getInputData(), rowInputs)) {
                matchedRows.add(decisionTableRowService.toRowResponse(row));
                outputs.add(decisionTableRowService.readOutputMap(row));
                if ("FIRST".equalsIgnoreCase(hitPolicy)) {
                    break;
                }
            }
        }
        long elapsed = System.currentTimeMillis() - start;

        return ApiResponse.success(DecisionTableExecutionResultDto.builder()
                .matchedRows(matchedRows)
                .outputs(outputs)
                .executionTimeMs(elapsed)
                .build());
    }

    /**
     * 简单的字符串化值比较：将输入值与行配置值都转为字符串比较。
     *
     * <p>注意：V1.1 阶段仅做字符串等值匹配，V1.2 阶段会引入完整的 operator
     * （eq/ne/gt/lt/gte/lte/in/contains/between）与 columnType 派生类型转换。
     */
    private boolean matchesInput(Map<String, Object> inputData, Map<String, Object> rowInputs) {
        if (rowInputs.isEmpty()) {
            return true; // 空输入视为通配
        }
        for (Map.Entry<String, Object> entry : rowInputs.entrySet()) {
            Object inputValue = inputData.get(entry.getKey());
            String expected = entry.getValue() == null ? "" : String.valueOf(entry.getValue());
            String actual = inputValue == null ? "" : String.valueOf(inputValue);
            if (!expected.equals(actual)) {
                return false;
            }
        }
        return true;
    }
}
