package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.EntityAttributeSetRequest;
import com.metaplatform.ont.service.EntityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ont/entities/{entityId}/attributes")
@RequiredArgsConstructor
public class EntityAttributeController {

    private final EntityService entityService;

    @GetMapping
    public ApiResponse<Map<String, Object>> listAttributes(@PathVariable String entityId) {
        return ApiResponse.success(entityService.getEntityAttributes(entityId));
    }

    @PutMapping("/{attributeId}")
    public ApiResponse<Map<String, Object>> setAttribute(@PathVariable String entityId,
                                                         @PathVariable String attributeId,
                                                         @Valid @RequestBody EntityAttributeSetRequest request) {
        return ApiResponse.success(entityService.setSingleAttribute(entityId, attributeId, request.getValue()));
    }

    @PostMapping("/batch")
    public ApiResponse<Map<String, Object>> batchSetAttributes(
            @PathVariable String entityId,
            @RequestBody List<EntityAttributeSetRequest> items) {
        return ApiResponse.success(entityService.batchSetAttributes(entityId, items));
    }
}