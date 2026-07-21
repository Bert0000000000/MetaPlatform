package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.ConceptCreateRequest;
import com.metaplatform.ont.dto.ConceptHierarchyResponse;
import com.metaplatform.ont.dto.ConceptResponse;
import com.metaplatform.ont.dto.ConceptUpdateRequest;
import com.metaplatform.ont.dto.MoveConceptRequest;
import com.metaplatform.ont.dto.OntologyConceptDto;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.service.ConceptService;
import com.metaplatform.ont.service.OntologyExploreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ont/concepts")
@RequiredArgsConstructor
public class ConceptController {

    private final ConceptService conceptService;
    private final OntologyExploreService ontologyExploreService;

    @PostMapping
    public ApiResponse<ConceptResponse> create(@Valid @RequestBody ConceptCreateRequest request) {
        return ApiResponse.success(conceptService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<ConceptResponse>> list() {
        return ApiResponse.success(conceptService.list());
    }

    @GetMapping("/{conceptId}")
    public ApiResponse<ConceptResponse> get(@PathVariable String conceptId) {
        return ApiResponse.success(conceptService.getById(conceptId));
    }

    @PutMapping("/{conceptId}")
    public ApiResponse<ConceptResponse> update(@PathVariable String conceptId,
                                               @Valid @RequestBody ConceptUpdateRequest request) {
        return ApiResponse.success(conceptService.update(conceptId, request));
    }

    @DeleteMapping("/{conceptId}")
    public ApiResponse<Void> delete(@PathVariable String conceptId) {
        conceptService.delete(conceptId);
        return ApiResponse.success();
    }

    @PostMapping("/{conceptId}/sub-concepts")
    public ApiResponse<ConceptResponse> createSubConcept(@PathVariable String conceptId,
                                                         @Valid @RequestBody ConceptCreateRequest request) {
        return ApiResponse.success(conceptService.createSubConcept(conceptId, request));
    }

    @PutMapping("/{conceptId}/move")
    public ApiResponse<ConceptResponse> move(@PathVariable String conceptId,
                                             @Valid @RequestBody MoveConceptRequest request) {
        return ApiResponse.success(conceptService.moveConcept(conceptId, request.getNewParentConceptId()));
    }

    @GetMapping("/hierarchy")
    public ApiResponse<ConceptHierarchyResponse> hierarchy(@RequestParam(required = false) String rootConceptId,
                                                          @RequestParam(required = false) Integer maxDepth) {
        return ApiResponse.success(conceptService.getHierarchy(rootConceptId, maxDepth));
    }

    @GetMapping("/{conceptId}/ancestors")
    public ApiResponse<ConceptHierarchyResponse> ancestors(@PathVariable String conceptId) {
        return ApiResponse.success(conceptService.getAncestors(conceptId));
    }

    @GetMapping("/{conceptId}/descendants")
    public ApiResponse<ConceptHierarchyResponse> descendants(@PathVariable String conceptId) {
        return ApiResponse.success(conceptService.getDescendants(conceptId));
    }

    /**
     * 概念搜索（V12-01 REQ-030）：按关键字、属性、标签过滤。
     * 返回对齐前端 OntologyConcept 形状的列表。
     */
    @GetMapping("/search")
    public ApiResponse<List<OntologyConceptDto>> search(@RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) String attribute,
                                                        @RequestParam(required = false) String tag) {
        return ApiResponse.success(ontologyExploreService.search(keyword, attribute, tag));
    }

    /**
     * 概念详情（V12-01 REQ-031）：返回完整属性、实例、关联概念。
     */
    @GetMapping("/{conceptId}/detail")
    public ApiResponse<OntologyConceptDto> detail(@PathVariable String conceptId) {
        return ApiResponse.success(ontologyExploreService.getDetail(conceptId));
    }
}
