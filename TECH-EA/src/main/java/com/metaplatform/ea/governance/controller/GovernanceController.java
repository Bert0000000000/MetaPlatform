package com.metaplatform.ea.governance.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.governance.principle.dto.*;
import com.metaplatform.ea.governance.principle.service.ArchitecturePrincipleService;
import com.metaplatform.ea.governance.principle.service.PrincipleCategoryService;
import com.metaplatform.ea.debt.dto.CreateTechDebtRequest;
import com.metaplatform.ea.debt.dto.TechDebtResponse;
import com.metaplatform.ea.debt.dto.UpdateTechDebtRequest;
import com.metaplatform.ea.debt.service.TechDebtService;
import com.metaplatform.ea.governance.review.dto.*;
import com.metaplatform.ea.governance.review.service.ReviewTemplateService;
import com.metaplatform.ea.governance.review.service.ReviewTicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/governance")
@RequiredArgsConstructor
public class GovernanceController {

    private final PrincipleCategoryService categoryService;
    private final ArchitecturePrincipleService principleService;
    private final ReviewTemplateService templateService;
    private final ReviewTicketService ticketService;
    private final TechDebtService techDebtService;

    // ---------- 原则分类 ----------
    @PostMapping("/principle-categories")
    public ApiResponse<PrincipleCategoryResponse> createCategory(@Valid @RequestBody CreatePrincipleCategoryRequest request) {
        return ApiResponse.success(categoryService.create(request));
    }

    @GetMapping("/principle-categories")
    public ApiResponse<List<PrincipleCategoryResponse>> listCategories() {
        return ApiResponse.success(categoryService.list());
    }

    @GetMapping("/principle-categories/{id}")
    public ApiResponse<PrincipleCategoryResponse> getCategory(@PathVariable UUID id) {
        return ApiResponse.success(categoryService.get(id));
    }

    @PutMapping("/principle-categories/{id}")
    public ApiResponse<PrincipleCategoryResponse> updateCategory(@PathVariable UUID id,
                                                                  @Valid @RequestBody UpdatePrincipleCategoryRequest request) {
        return ApiResponse.success(categoryService.update(id, request));
    }

    @DeleteMapping("/principle-categories/{id}")
    public ApiResponse<Void> deleteCategory(@PathVariable UUID id) {
        categoryService.delete(id);
        return ApiResponse.success();
    }

    // ---------- 架构原则 ----------
    @PostMapping("/principles")
    public ApiResponse<ArchitecturePrincipleResponse> createPrinciple(@Valid @RequestBody CreateArchitecturePrincipleRequest request) {
        return ApiResponse.success(principleService.create(request));
    }

    @GetMapping("/principles")
    public ApiResponse<List<ArchitecturePrincipleResponse>> listPrinciples(
            @RequestParam(required = false) UUID categoryId) {
        return ApiResponse.success(principleService.list(categoryId));
    }

    @GetMapping("/principles/{id}")
    public ApiResponse<ArchitecturePrincipleResponse> getPrinciple(@PathVariable UUID id) {
        return ApiResponse.success(principleService.get(id));
    }

    @PutMapping("/principles/{id}")
    public ApiResponse<ArchitecturePrincipleResponse> updatePrinciple(@PathVariable UUID id,
                                                                       @Valid @RequestBody UpdateArchitecturePrincipleRequest request) {
        return ApiResponse.success(principleService.update(id, request));
    }

    @DeleteMapping("/principles/{id}")
    public ApiResponse<Void> deletePrinciple(@PathVariable UUID id) {
        principleService.delete(id);
        return ApiResponse.success();
    }

    // ---------- 评审模板 ----------
    @PostMapping("/review-templates")
    public ApiResponse<ReviewTemplateResponse> createTemplate(@Valid @RequestBody CreateReviewTemplateRequest request) {
        return ApiResponse.success(templateService.create(request));
    }

    @GetMapping("/review-templates")
    public ApiResponse<List<ReviewTemplateResponse>> listTemplates() {
        return ApiResponse.success(templateService.list());
    }

    @GetMapping("/review-templates/{id}")
    public ApiResponse<ReviewTemplateResponse> getTemplate(@PathVariable UUID id) {
        return ApiResponse.success(templateService.get(id));
    }

    @PutMapping("/review-templates/{id}")
    public ApiResponse<ReviewTemplateResponse> updateTemplate(@PathVariable UUID id,
                                                               @Valid @RequestBody UpdateReviewTemplateRequest request) {
        return ApiResponse.success(templateService.update(id, request));
    }

    @DeleteMapping("/review-templates/{id}")
    public ApiResponse<Void> deleteTemplate(@PathVariable UUID id) {
        templateService.delete(id);
        return ApiResponse.success();
    }

    // ---------- 评审工单 ----------
    @PostMapping("/review-tickets")
    public ApiResponse<ReviewTicketResponse> createTicket(@Valid @RequestBody CreateReviewTicketRequest request) {
        return ApiResponse.success(ticketService.create(request));
    }

    @GetMapping("/review-tickets")
    public ApiResponse<List<ReviewTicketResponse>> listTickets(@RequestParam(required = false) String status) {
        return ApiResponse.success(ticketService.list(status));
    }

    @GetMapping("/review-tickets/{id}")
    public ApiResponse<ReviewTicketResponse> getTicket(@PathVariable UUID id) {
        return ApiResponse.success(ticketService.get(id));
    }

    @PutMapping("/review-tickets/{id}")
    public ApiResponse<ReviewTicketResponse> updateTicket(@PathVariable UUID id,
                                                           @Valid @RequestBody UpdateReviewTicketRequest request) {
        return ApiResponse.success(ticketService.update(id, request));
    }

    @DeleteMapping("/review-tickets/{id}")
    public ApiResponse<Void> deleteTicket(@PathVariable UUID id) {
        ticketService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/review-tickets/{id}/start")
    public ApiResponse<ReviewTicketResponse> startReview(@PathVariable UUID id,
                                                          @RequestParam(required = false) String reviewer) {
        return ApiResponse.success(ticketService.startReview(id, reviewer));
    }

    @PostMapping("/review-tickets/{id}/approve")
    public ApiResponse<ReviewTicketResponse> approveTicket(@PathVariable UUID id,
                                                            @Valid @RequestBody ReviewTicketScoreRequest request) {
        return ApiResponse.success(ticketService.approve(id, request));
    }

    @PostMapping("/review-tickets/{id}/reject")
    public ApiResponse<ReviewTicketResponse> rejectTicket(@PathVariable UUID id,
                                                           @Valid @RequestBody ReviewTicketScoreRequest request) {
        return ApiResponse.success(ticketService.reject(id, request));
    }

    @PostMapping("/review-tickets/{id}/comments")
    public ApiResponse<ReviewTicketResponse> addTicketComment(@PathVariable UUID id,
                                                               @RequestParam String reviewer,
                                                               @RequestParam String comment) {
        return ApiResponse.success(ticketService.addComment(id, reviewer, comment));
    }

    // ---------- 技术债务（治理视图） ----------
    @PostMapping("/tech-debts")
    public ApiResponse<TechDebtResponse> createTechDebt(@Valid @RequestBody CreateTechDebtRequest request) {
        return ApiResponse.success(techDebtService.create(request));
    }

    @GetMapping("/tech-debts")
    public ApiResponse<List<TechDebtResponse>> listTechDebt(
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(techDebtService.listByLevelAndStatus(level, status));
    }

    @GetMapping("/tech-debts/{id}")
    public ApiResponse<TechDebtResponse> getTechDebt(@PathVariable UUID id) {
        return ApiResponse.success(techDebtService.get(id));
    }

    @PutMapping("/tech-debts/{id}")
    public ApiResponse<TechDebtResponse> updateTechDebt(@PathVariable UUID id,
                                                         @Valid @RequestBody UpdateTechDebtRequest request) {
        return ApiResponse.success(techDebtService.update(id, request));
    }

    @DeleteMapping("/tech-debts/{id}")
    public ApiResponse<Void> deleteTechDebt(@PathVariable UUID id) {
        techDebtService.delete(id);
        return ApiResponse.success();
    }
}
