package com.metaplatform.iam.position.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.position.dto.CreatePositionRequest;
import com.metaplatform.iam.position.dto.PositionResponse;
import com.metaplatform.iam.position.dto.UpdatePositionRequest;
import com.metaplatform.iam.position.service.PositionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/iam/positions")
@RequiredArgsConstructor
public class PositionController {

    private final PositionService positionService;

    @PostMapping
    public ApiResponse<PositionResponse> create(@Valid @RequestBody CreatePositionRequest request) {
        return ApiResponse.success(positionService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<PositionResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(positionService.list(tenantId, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<PositionResponse> get(@PathVariable String id) {
        return ApiResponse.success(positionService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<PositionResponse> update(@PathVariable String id,
                                                @Valid @RequestBody UpdatePositionRequest request) {
        return ApiResponse.success(positionService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        positionService.softDelete(id);
        return ApiResponse.success();
    }
}