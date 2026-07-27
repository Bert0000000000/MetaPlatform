package com.metaplatform.ea.debt.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.debt.dto.CreateTechDebtRequest;
import com.metaplatform.ea.debt.dto.TechDebtImpactResponse;
import com.metaplatform.ea.debt.dto.TechDebtResponse;
import com.metaplatform.ea.debt.dto.UpdateTechDebtRequest;
import com.metaplatform.ea.debt.service.TechDebtService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * 技术债务统一入口。
 * 原 GovernanceController 中的 /governance/tech-debts 端点已迁入此处，
 * /governance/tech-debts 作为兼容路径保留。
 */
@RestController
@RequestMapping({"/api/v1/ea/tech-debts", "/api/v1/ea/governance/tech-debts"})
@RequiredArgsConstructor
public class TechDebtController {

    private final TechDebtService service;

    @PostMapping
    public ApiResponse<TechDebtResponse> create(@Valid @RequestBody CreateTechDebtRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<TechDebtResponse>> list(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String scopeType,
            @RequestParam(required = false) UUID scopeId,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String status) {
        if (StringUtils.hasText(level) || StringUtils.hasText(status)) {
            return ApiResponse.success(service.listByLevelAndStatus(level, status));
        }
        return ApiResponse.success(service.list(severity, scopeType, scopeId));
    }

    @GetMapping("/{id}")
    public ApiResponse<TechDebtResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TechDebtResponse> update(@PathVariable UUID id,
                                                @Valid @RequestBody UpdateTechDebtRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/impact")
    public ApiResponse<TechDebtImpactResponse> analyzeImpact(@PathVariable UUID id) {
        return ApiResponse.success(service.analyzeImpact(id));
    }
}
