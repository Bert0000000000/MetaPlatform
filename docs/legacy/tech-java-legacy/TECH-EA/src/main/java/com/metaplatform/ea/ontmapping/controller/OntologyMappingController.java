package com.metaplatform.ea.ontmapping.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.ontmapping.dto.*;
import com.metaplatform.ea.ontmapping.service.ConceptMappingRuleService;
import com.metaplatform.ea.ontmapping.service.OntologyMappingSyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/ontology-mappings")
@RequiredArgsConstructor
public class OntologyMappingController {

    private final ConceptMappingRuleService ruleService;
    private final OntologyMappingSyncService syncService;

    @PostMapping("/rules")
    public ApiResponse<ConceptMappingRuleResponse> createRule(@Valid @RequestBody CreateConceptMappingRuleRequest request) {
        return ApiResponse.success(ruleService.create(request));
    }

    @GetMapping("/rules")
    public ApiResponse<List<ConceptMappingRuleResponse>> listRules(
            @RequestParam(required = false) String assetType) {
        return ApiResponse.success(ruleService.list(assetType));
    }

    @GetMapping("/rules/{id}")
    public ApiResponse<ConceptMappingRuleResponse> getRule(@PathVariable UUID id) {
        return ApiResponse.success(ruleService.get(id));
    }

    @PutMapping("/rules/{id}")
    public ApiResponse<ConceptMappingRuleResponse> updateRule(@PathVariable UUID id,
                                                               @Valid @RequestBody UpdateConceptMappingRuleRequest request) {
        return ApiResponse.success(ruleService.update(id, request));
    }

    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteRule(@PathVariable UUID id) {
        ruleService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/sync-to-ontology")
    public ApiResponse<SyncResultResponse> syncToOntology(
            @RequestParam(required = false) String assetType) {
        return ApiResponse.success(syncService.syncToOntology(assetType));
    }

    @PostMapping("/sync-from-ontology")
    public ApiResponse<SyncResultResponse> syncFromOntology(
            @RequestParam(required = false) String assetType) {
        return ApiResponse.success(syncService.syncFromOntology(assetType));
    }

    @GetMapping("/changes")
    public ApiResponse<List<OntologyChangeEventResponse>> listPendingChanges(
            @RequestParam(required = false) String conceptId) {
        return ApiResponse.success(syncService.listPendingChanges(conceptId));
    }

    @PostMapping("/changes/{id}/resolve")
    public ApiResponse<OntologyChangeEventResponse> resolveChange(@PathVariable UUID id) {
        return ApiResponse.success(syncService.resolveChange(id));
    }

    @PostMapping("/webhook")
    public ApiResponse<Void> receiveWebhook(@Valid @RequestBody OntologyChangeWebhookRequest request) {
        syncService.handleOntologyChangeWebhook(request);
        return ApiResponse.success();
    }
}
