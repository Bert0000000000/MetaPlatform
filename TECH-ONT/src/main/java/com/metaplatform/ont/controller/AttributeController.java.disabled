package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.AttributeCreateRequest;
import com.metaplatform.ont.dto.AttributeResponse;
import com.metaplatform.ont.dto.AttributeUpdateRequest;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.service.AttributeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ont/attributes")
@RequiredArgsConstructor
public class AttributeController {

    private final AttributeService attributeService;

    @PostMapping
    public ApiResponse<AttributeResponse> create(@Valid @RequestBody AttributeCreateRequest request) {
        return ApiResponse.success(attributeService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<AttributeResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String dataType,
            @RequestParam(required = false) String conceptId) {
        return ApiResponse.success(attributeService.list(keyword, dataType, conceptId));
    }

    @GetMapping("/{attributeId}")
    public ApiResponse<AttributeResponse> get(@PathVariable String attributeId) {
        return ApiResponse.success(attributeService.getById(attributeId));
    }

    @PutMapping("/{attributeId}")
    public ApiResponse<AttributeResponse> update(@PathVariable String attributeId,
                                                 @Valid @RequestBody AttributeUpdateRequest request) {
        return ApiResponse.success(attributeService.update(attributeId, request));
    }

    @DeleteMapping("/{attributeId}")
    public ApiResponse<Void> delete(@PathVariable String attributeId,
                                    @RequestParam(required = false, defaultValue = "false") boolean cascade) {
        attributeService.delete(attributeId, cascade);
        return ApiResponse.success();
    }
}
