package com.metaplatform.ea.mapping.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.mapping.dto.ConsistencyCheckResponse;
import com.metaplatform.ea.mapping.dto.CreateMappingRequest;
import com.metaplatform.ea.mapping.dto.MapConceptRequest;
import com.metaplatform.ea.mapping.dto.MappingFilterRequest;
import com.metaplatform.ea.mapping.dto.MappingResponse;
import com.metaplatform.ea.mapping.dto.SyncResultResponse;
import com.metaplatform.ea.mapping.dto.UpdateMappingRequest;
import com.metaplatform.ea.mapping.service.CapabilityConceptMappingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CapabilityConceptMappingController {

    private final CapabilityConceptMappingService mappingService;

    @PostMapping("/api/v1/ea/capability-mappings")
    public ApiResponse<MappingResponse> create(@Valid @RequestBody CreateMappingRequest request) {
        return ApiResponse.success(mappingService.create(request));
    }

    @GetMapping("/api/v1/ea/capability-mappings")
    public ApiResponse<List<MappingResponse>> list() {
        return ApiResponse.success(mappingService.list());
    }

    @GetMapping("/api/v1/ea/capability-mappings/search")
    public ApiResponse<List<MappingResponse>> search(
            @RequestParam(required = false) String mappingType,
            @RequestParam(required = false) String keyword) {
        MappingFilterRequest filter = new MappingFilterRequest();
        filter.setMappingType(mappingType);
        filter.setKeyword(keyword);
        return ApiResponse.success(mappingService.listWithFilters(filter));
    }

    @GetMapping("/api/v1/ea/capability-mappings/consistency")
    public ApiResponse<ConsistencyCheckResponse> consistency() {
        return ApiResponse.success(mappingService.checkConsistency());
    }

    @PostMapping("/api/v1/ea/capability-mappings/sync")
    public ApiResponse<SyncResultResponse> sync(@RequestBody(required = false) List<CapabilityConceptMappingService.OntConceptSnapshot> concepts) {
        return ApiResponse.success(mappingService.syncFromOntology(concepts));
    }

    @GetMapping("/api/v1/ea/capability-mappings/{id}")
    public ApiResponse<MappingResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(mappingService.get(id));
    }

    @PutMapping("/api/v1/ea/capability-mappings/{id}")
    public ApiResponse<MappingResponse> update(@PathVariable UUID id,
                                                @Valid @RequestBody UpdateMappingRequest request) {
        return ApiResponse.success(mappingService.update(id, request));
    }

    @DeleteMapping("/api/v1/ea/capability-mappings/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        mappingService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/api/v1/ea/capabilities/{id}/map-concept")
    public ApiResponse<MappingResponse> mapConcept(@PathVariable UUID id,
                                                    @Valid @RequestBody MapConceptRequest request) {
        return ApiResponse.success(mappingService.mapConcept(id, request));
    }

    @GetMapping("/api/v1/ea/capabilities/{id}/concepts")
    public ApiResponse<List<MappingResponse>> getConceptsForCapability(@PathVariable UUID id) {
        return ApiResponse.success(mappingService.getConceptsForCapability(id));
    }

    @GetMapping("/api/v1/ea/concepts/{conceptId}/capabilities")
    public ApiResponse<List<MappingResponse>> getCapabilitiesForConcept(@PathVariable String conceptId) {
        return ApiResponse.success(mappingService.getCapabilitiesForConcept(conceptId));
    }
}
