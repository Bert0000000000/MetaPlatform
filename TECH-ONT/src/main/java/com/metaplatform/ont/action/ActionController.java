package com.metaplatform.ont.action;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Action Controller (stub for P2.1 build).
 * P5.1 ActionProposalController in TECH-ACTION supersedes this controller.
 */
@RestController
@RequestMapping("/api/v1/ont/actions")
@RequiredArgsConstructor
public class ActionController {

    private final ActionService service;

    @PostMapping
    public ApiResponse<ActionEntity> create(@RequestBody ActionEntity entity) {
        entity.setTenantId(TenantContext.tenantIdOrDefault());
        return ApiResponse.success(service.create(entity));
    }

    @GetMapping
    public ApiResponse<List<ActionEntity>> list(@RequestParam(required = false) String conceptCode,
                                                @RequestParam(required = false) String riskLevel) {
        String tid = TenantContext.tenantIdOrDefault();
        return ApiResponse.success(riskLevel != null && !riskLevel.isBlank()
                ? service.listByRisk(tid, riskLevel)
                : conceptCode != null && !conceptCode.isBlank()
                ? service.listByConcept(tid, conceptCode)
                : service.listAll(tid));
    }

    @GetMapping("/by-code/{actionCode}")
    public ApiResponse<ActionEntity> getByCode(@PathVariable String actionCode) {
        return ApiResponse.success(service.getByCode(TenantContext.tenantIdOrDefault(), actionCode));
    }

    @PutMapping("/{id}")
    public ApiResponse<ActionEntity> update(@PathVariable String id, @RequestBody ActionEntity patch) {
        return ApiResponse.success(service.update(id, patch));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ApiResponse.success();
    }
}
