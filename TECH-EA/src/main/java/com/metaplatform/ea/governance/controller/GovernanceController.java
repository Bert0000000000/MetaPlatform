package com.metaplatform.ea.governance.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.governance.principle.dto.*;
import com.metaplatform.ea.governance.principle.service.ArchitecturePrincipleService;
import com.metaplatform.ea.governance.principle.service.PrincipleCategoryService;
import com.metaplatform.ea.governance.review.dto.*;
import com.metaplatform.ea.governance.review.service.ReviewTemplateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * 治理控制器：仅保留原则分类、架构原则、评审模板。
 * 技术债务已迁入 TechDebtController（/tech-debts + /governance/tech-debts），
 * 评审工单已迁入 ArchitectureReviewController（/architecture-reviews + /governance/review-tickets）。
 */
@RestController
@RequestMapping("/api/v1/ea/governance")
@RequiredArgsConstructor
public class GovernanceController {

    private final PrincipleCategoryService categoryService;
    private final ArchitecturePrincipleService principleService;
    private final ReviewTemplateService templateService;

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
}
