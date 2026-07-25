package com.metaplatform.ea.review.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.governance.review.dto.CreateReviewTicketRequest;
import com.metaplatform.ea.governance.review.dto.ReviewTicketResponse;
import com.metaplatform.ea.governance.review.dto.ReviewTicketScoreRequest;
import com.metaplatform.ea.governance.review.dto.UpdateReviewTicketRequest;
import com.metaplatform.ea.governance.review.service.ReviewTicketService;
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

/**
 * 架构评审 + 评审工单的统一入口。
 * 原 GovernanceController 中的 /governance/review-tickets 端点已迁入此处，
 * /governance/review-tickets 作为兼容路径保留（由 ReviewTicketService 支撑）。
 */
@RestController
@RequiredArgsConstructor
public class ArchitectureReviewController {

    private static final String ARCH_REVIEW_BASE = "/api/v1/ea/architecture-reviews";
    private static final String REVIEW_TICKET_BASE = "/api/v1/ea/governance/review-tickets";

    private final ArchitectureReviewService service;
    private final ReviewTicketService ticketService;

    // ---------- 架构评审（/architecture-reviews） ----------
    @PostMapping(ARCH_REVIEW_BASE)
    public ApiResponse<ArchitectureReviewResponse> create(@Valid @RequestBody CreateArchitectureReviewRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping(ARCH_REVIEW_BASE)
    public ApiResponse<List<ArchitectureReviewResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID targetId,
            @RequestParam(required = false) String targetType) {
        return ApiResponse.success(service.list(status, targetId, targetType));
    }

    @GetMapping(ARCH_REVIEW_BASE + "/{id}")
    public ApiResponse<ArchitectureReviewResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping(ARCH_REVIEW_BASE + "/{id}")
    public ApiResponse<ArchitectureReviewResponse> update(@PathVariable UUID id,
                                                          @Valid @RequestBody UpdateArchitectureReviewRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping(ARCH_REVIEW_BASE + "/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }

    @PostMapping(ARCH_REVIEW_BASE + "/{id}/submit")
    public ApiResponse<ArchitectureReviewResponse> submit(@PathVariable UUID id,
                                                          @Valid @RequestBody ReviewActionRequest request) {
        return ApiResponse.success(service.submit(id, request));
    }

    @PostMapping(ARCH_REVIEW_BASE + "/{id}/approve")
    public ApiResponse<ArchitectureReviewResponse> approve(@PathVariable UUID id,
                                                           @Valid @RequestBody ReviewActionRequest request) {
        return ApiResponse.success(service.approve(id, request));
    }

    @PostMapping(ARCH_REVIEW_BASE + "/{id}/reject")
    public ApiResponse<ArchitectureReviewResponse> reject(@PathVariable UUID id,
                                                          @Valid @RequestBody ReviewActionRequest request) {
        return ApiResponse.success(service.reject(id, request));
    }

    @PostMapping(ARCH_REVIEW_BASE + "/{id}/comments")
    public ApiResponse<ArchitectureReviewResponse> addComment(@PathVariable UUID id,
                                                             @Valid @RequestBody ReviewActionRequest request) {
        return ApiResponse.success(service.addComment(id, request));
    }

    // ---------- 评审工单（/governance/review-tickets，从 GovernanceController 迁入） ----------
    @PostMapping(REVIEW_TICKET_BASE)
    public ApiResponse<ReviewTicketResponse> createTicket(@Valid @RequestBody CreateReviewTicketRequest request) {
        return ApiResponse.success(ticketService.create(request));
    }

    @GetMapping(REVIEW_TICKET_BASE)
    public ApiResponse<List<ReviewTicketResponse>> listTickets(@RequestParam(required = false) String status) {
        return ApiResponse.success(ticketService.list(status));
    }

    @GetMapping(REVIEW_TICKET_BASE + "/{id}")
    public ApiResponse<ReviewTicketResponse> getTicket(@PathVariable UUID id) {
        return ApiResponse.success(ticketService.get(id));
    }

    @PutMapping(REVIEW_TICKET_BASE + "/{id}")
    public ApiResponse<ReviewTicketResponse> updateTicket(@PathVariable UUID id,
                                                           @Valid @RequestBody UpdateReviewTicketRequest request) {
        return ApiResponse.success(ticketService.update(id, request));
    }

    @DeleteMapping(REVIEW_TICKET_BASE + "/{id}")
    public ApiResponse<Void> deleteTicket(@PathVariable UUID id) {
        ticketService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping(REVIEW_TICKET_BASE + "/{id}/start")
    public ApiResponse<ReviewTicketResponse> startReview(@PathVariable UUID id,
                                                          @RequestParam(required = false) String reviewer) {
        return ApiResponse.success(ticketService.startReview(id, reviewer));
    }

    @PostMapping(REVIEW_TICKET_BASE + "/{id}/approve")
    public ApiResponse<ReviewTicketResponse> approveTicket(@PathVariable UUID id,
                                                            @Valid @RequestBody ReviewTicketScoreRequest request) {
        return ApiResponse.success(ticketService.approve(id, request));
    }

    @PostMapping(REVIEW_TICKET_BASE + "/{id}/reject")
    public ApiResponse<ReviewTicketResponse> rejectTicket(@PathVariable UUID id,
                                                           @Valid @RequestBody ReviewTicketScoreRequest request) {
        return ApiResponse.success(ticketService.reject(id, request));
    }

    @PostMapping(REVIEW_TICKET_BASE + "/{id}/comments")
    public ApiResponse<ReviewTicketResponse> addTicketComment(@PathVariable UUID id,
                                                               @RequestParam String reviewer,
                                                               @RequestParam String comment) {
        return ApiResponse.success(ticketService.addComment(id, reviewer, comment));
    }
}
