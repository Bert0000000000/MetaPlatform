package com.metaplatform.ea.review.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.review.dto.ArchitectureReviewResponse;
import com.metaplatform.ea.review.dto.CreateArchitectureReviewRequest;
import com.metaplatform.ea.review.dto.ReviewActionRequest;
import com.metaplatform.ea.review.dto.UpdateArchitectureReviewRequest;
import com.metaplatform.ea.review.service.ArchitectureReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/architecture-reviews")
@RequiredArgsConstructor
public class ArchitectureReviewController {

    private final ArchitectureReviewService service;

    @PostMapping
    public ApiResponse<ArchitectureReviewResponse> create(@Valid @RequestBody CreateArchitectureReviewRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<ArchitectureReviewResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID targetId,
            @RequestParam(required = false) String targetType) {
        return ApiResponse.success(service.list(status, targetId, targetType));
    }

    @GetMapping("/{id}")
    public ApiResponse<ArchitectureReviewResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<ArchitectureReviewResponse> update(@PathVariable UUID id,
                                                          @Valid @RequestBody UpdateArchitectureReviewRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/submit")
    public ApiResponse<ArchitectureReviewResponse> submit(@PathVariable UUID id,
                                                          @Valid @RequestBody ReviewActionRequest request) {
        return ApiResponse.success(service.submit(id, request));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<ArchitectureReviewResponse> approve(@PathVariable UUID id,
                                                           @Valid @RequestBody ReviewActionRequest request) {
        return ApiResponse.success(service.approve(id, request));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<ArchitectureReviewResponse> reject(@PathVariable UUID id,
                                                          @Valid @RequestBody ReviewActionRequest request) {
        return ApiResponse.success(service.reject(id, request));
    }

    @PostMapping("/{id}/comments")
    public ApiResponse<ArchitectureReviewResponse> addComment(@PathVariable UUID id,
                                                             @Valid @RequestBody ReviewActionRequest request) {
        return ApiResponse.success(service.addComment(id, request));
    }
}