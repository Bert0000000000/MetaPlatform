package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.BatchEntityCreateRequest;
import com.metaplatform.ont.dto.BatchEntityCreateResponse;
import com.metaplatform.ont.dto.EntityAttributeBatchUpdateRequest;
import com.metaplatform.ont.dto.EntityCreateRequest;
import com.metaplatform.ont.dto.EntityResponse;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.service.EntityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ont/entities")
@RequiredArgsConstructor
public class EntityController {

    private final EntityService entityService;

    @PostMapping
    public ApiResponse<EntityResponse> create(@Valid @RequestBody EntityCreateRequest request) {
        return ApiResponse.success(entityService.create(request));
    }

    @PostMapping("/batch")
    public ApiResponse<BatchEntityCreateResponse> batchCreate(@Valid @RequestBody BatchEntityCreateRequest request) {
        return ApiResponse.success(entityService.batchCreate(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<EntityResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String conceptId,
            @RequestParam(required = false, defaultValue = "false") boolean includeAttributes) {
        return ApiResponse.success(entityService.list(keyword, conceptId, includeAttributes));
    }

    @GetMapping("/{entityId}")
    public ApiResponse<EntityResponse> get(@PathVariable String entityId) {
        return ApiResponse.success(entityService.getById(entityId));
    }

    @PutMapping("/{entityId}")
    public ApiResponse<EntityResponse> update(@PathVariable String entityId,
                                              @Valid @RequestBody EntityCreateRequest request) {
        return ApiResponse.success(entityService.update(entityId, request));
    }

    @DeleteMapping("/{entityId}")
    public ApiResponse<Void> delete(@PathVariable String entityId) {
        entityService.delete(entityId);
        return ApiResponse.success();
    }

    @GetMapping("/by-concept/{conceptId}")
    public ApiResponse<PageResponse<EntityResponse>> listByConcept(@PathVariable String conceptId) {
        return ApiResponse.success(entityService.listByConceptId(conceptId));
    }

    @PutMapping("/{entityId}/attributes")
    public ApiResponse<Map<String, Object>> setAttributes(@PathVariable String entityId,
                                                          @Valid @RequestBody EntityAttributeBatchUpdateRequest request) {
        return ApiResponse.success(entityService.setAttributes(entityId, request));
    }
}
