package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.dto.RelationTypeCreateRequest;
import com.metaplatform.ont.dto.RelationTypeResponse;
import com.metaplatform.ont.dto.RelationTypeUpdateRequest;
import com.metaplatform.ont.service.RelationTypeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ont/relations/types")
@RequiredArgsConstructor
public class RelationTypeController {

    private final RelationTypeService relationTypeService;

    @PostMapping
    public ApiResponse<RelationTypeResponse> create(@Valid @RequestBody RelationTypeCreateRequest request) {
        return ApiResponse.success(relationTypeService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<RelationTypeResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sourceConceptId,
            @RequestParam(required = false) String targetConceptId,
            @RequestParam(required = false) String direction) {
        return ApiResponse.success(relationTypeService.list(keyword, sourceConceptId, targetConceptId, direction));
    }

    @GetMapping("/{relationTypeId}")
    public ApiResponse<RelationTypeResponse> get(@PathVariable String relationTypeId) {
        return ApiResponse.success(relationTypeService.getById(relationTypeId));
    }

    @GetMapping("/by-code/{code}")
    public ApiResponse<RelationTypeResponse> getByCode(@PathVariable String code) {
        return ApiResponse.success(relationTypeService.getByCode(code));
    }

    @PutMapping("/{relationTypeId}")
    public ApiResponse<RelationTypeResponse> update(@PathVariable String relationTypeId,
                                                    @Valid @RequestBody RelationTypeUpdateRequest request) {
        return ApiResponse.success(relationTypeService.update(relationTypeId, request));
    }

    @DeleteMapping("/{relationTypeId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String relationTypeId,
                                                   @RequestParam(required = false, defaultValue = "false") boolean cascade) {
        long count = relationTypeService.delete(relationTypeId, cascade);
        return ApiResponse.success(Map.of(
                "relationTypeId", relationTypeId,
                "deleted", true,
                "cascadeDeletedInstances", count
        ));
    }
}