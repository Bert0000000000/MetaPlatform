package com.metaplatform.rule.decisiontable.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.decisiontable.dto.AddColumnRequest;
import com.metaplatform.rule.decisiontable.dto.AddRowRequest;
import com.metaplatform.rule.decisiontable.dto.BatchImportRowsRequest;
import com.metaplatform.rule.decisiontable.dto.CreateDecisionTableRequest;
import com.metaplatform.rule.decisiontable.dto.DecisionTableRowResponse;
import com.metaplatform.rule.decisiontable.dto.DecisionTableResponse;
import com.metaplatform.rule.decisiontable.dto.UpdateColumnRequest;
import com.metaplatform.rule.decisiontable.dto.UpdateDecisionTableRequest;
import com.metaplatform.rule.decisiontable.dto.UpdateRowRequest;
import com.metaplatform.rule.decisiontable.dto.ValidationResultDto;
import com.metaplatform.rule.decisiontable.service.DecisionTableRowService;
import com.metaplatform.rule.decisiontable.service.DecisionTableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    @GetMapping
    public ApiResponse<PageResponse<DecisionTableResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(decisionTableService.list(page, pageSize));
    }

    @GetMapping("/{id}")
    public ApiResponse<DecisionTableResponse> get(@PathVariable String id) {
        return ApiResponse.success(decisionTableService.getById(id));
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
}
