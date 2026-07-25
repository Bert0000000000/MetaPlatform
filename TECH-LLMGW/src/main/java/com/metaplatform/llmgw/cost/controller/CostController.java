package com.metaplatform.llmgw.cost.controller;

import com.metaplatform.llmgw.common.ApiResponse;
import com.metaplatform.llmgw.cost.dto.*;
import com.metaplatform.llmgw.cost.service.CostService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/llmgw/cost")
@RequiredArgsConstructor
public class CostController {

    private final CostService costService;

    @GetMapping
    public ApiResponse<Page<CostRecordDto>> list(Pageable pageable) {
        return ApiResponse.ok(costService.list(pageable));
    }

    @GetMapping("/summary")
    public ApiResponse<CostSummaryDto> summary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return ApiResponse.ok(costService.getSummary(start, end));
    }

    @GetMapping("/by-model")
    public ApiResponse<List<CostByModelDto>> byModel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return ApiResponse.ok(costService.getSummaryByModel(start, end));
    }

    @GetMapping("/by-user")
    public ApiResponse<List<CostByUserDto>> byUser(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return ApiResponse.ok(costService.getSummaryByUser(start, end));
    }

    @PostMapping("/export")
    public ApiResponse<List<CostRecordDto>> export(@RequestBody CostQueryRequest request) {
        Page<CostRecordDto> page = costService.query(request);
        return ApiResponse.ok(page.getContent());
    }

    @PostMapping("/calculate")
    public ApiResponse<BigDecimal> calculate(
            @RequestParam String modelId,
            @RequestParam int inputTokens,
            @RequestParam int outputTokens) {
        return ApiResponse.ok(costService.calculateCost(modelId, inputTokens, outputTokens));
    }
}
