package com.metaplatform.ea.capability.controller;

import com.metaplatform.ea.capability.dto.*;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/capabilities")
@RequiredArgsConstructor
public class BusinessCapabilityController {

    private final BusinessCapabilityService capabilityService;

    @PostMapping
    public ApiResponse<CapabilityResponse> create(@Valid @RequestBody CreateCapabilityRequest request) {
        return ApiResponse.success(capabilityService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<CapabilityResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(capabilityService.list(status, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<CapabilityResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(capabilityService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<CapabilityResponse> update(@PathVariable UUID id,
                                                   @Valid @RequestBody UpdateCapabilityRequest request) {
        return ApiResponse.success(capabilityService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        capabilityService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/tree")
    public ApiResponse<List<CapabilityTreeNode>> getTree() {
        return ApiResponse.success(capabilityService.getTree());
    }

    @GetMapping("/{id}/children")
    public ApiResponse<List<CapabilityResponse>> getChildren(@PathVariable UUID id) {
        return ApiResponse.success(capabilityService.getChildren(id));
    }

    @GetMapping("/{id}/ancestors")
    public ApiResponse<List<CapabilityResponse>> getAncestors(@PathVariable UUID id) {
        return ApiResponse.success(capabilityService.getAncestors(id));
    }

    @PostMapping("/{id}/move")
    public ApiResponse<CapabilityResponse> move(@PathVariable UUID id,
                                                 @RequestBody MoveCapabilityRequest request) {
        return ApiResponse.success(capabilityService.move(id, request));
    }
}
