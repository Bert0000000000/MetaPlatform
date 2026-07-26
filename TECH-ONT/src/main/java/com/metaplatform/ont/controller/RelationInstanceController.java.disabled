package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.dto.RelationInstanceCreateRequest;
import com.metaplatform.ont.dto.RelationInstanceResponse;
import com.metaplatform.ont.service.RelationInstanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ont/relations/instances")
@RequiredArgsConstructor
public class RelationInstanceController {

    private final RelationInstanceService relationInstanceService;

    @PostMapping
    public ApiResponse<RelationInstanceResponse> create(@Valid @RequestBody RelationInstanceCreateRequest request) {
        return ApiResponse.success(relationInstanceService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<RelationInstanceResponse>> list(
            @RequestParam(required = false) String relationTypeId,
            @RequestParam(required = false) String sourceEntityId,
            @RequestParam(required = false) String targetEntityId) {
        return ApiResponse.success(relationInstanceService.list(relationTypeId, sourceEntityId, targetEntityId));
    }

    @GetMapping("/{relationInstanceId}")
    public ApiResponse<RelationInstanceResponse> get(@PathVariable String relationInstanceId) {
        return ApiResponse.success(relationInstanceService.getById(relationInstanceId));
    }

    @DeleteMapping("/{relationInstanceId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String relationInstanceId) {
        relationInstanceService.delete(relationInstanceId);
        return ApiResponse.success(Map.of(
                "relationInstanceId", relationInstanceId,
                "deleted", true
        ));
    }
}