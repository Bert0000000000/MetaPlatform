package com.metaplatform.ea.process.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.process.dto.BusinessProcessResponse;
import com.metaplatform.ea.process.dto.BusinessProcessVersionResponse;
import com.metaplatform.ea.process.dto.CreateBusinessProcessRequest;
import com.metaplatform.ea.process.dto.CreateProcessVersionRequest;
import com.metaplatform.ea.process.dto.UpdateBusinessProcessRequest;
import com.metaplatform.ea.process.service.BusinessProcessService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/business-processes")
@RequiredArgsConstructor
public class BusinessProcessController {

    private final BusinessProcessService businessProcessService;

    @PostMapping
    public ApiResponse<BusinessProcessResponse> create(@Valid @RequestBody CreateBusinessProcessRequest request) {
        return ApiResponse.success(businessProcessService.create(request));
    }

    @GetMapping
    public ApiResponse<List<BusinessProcessResponse>> list() {
        return ApiResponse.success(businessProcessService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<BusinessProcessResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(businessProcessService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<BusinessProcessResponse> update(@PathVariable UUID id,
                                                        @Valid @RequestBody UpdateBusinessProcessRequest request) {
        return ApiResponse.success(businessProcessService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        businessProcessService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/versions")
    public ApiResponse<BusinessProcessVersionResponse> createVersion(@PathVariable UUID id,
                                                                    @Valid @RequestBody CreateProcessVersionRequest request) {
        return ApiResponse.success(businessProcessService.createVersion(id, request));
    }

    @GetMapping("/{id}/versions")
    public ApiResponse<List<BusinessProcessVersionResponse>> listVersions(@PathVariable UUID id) {
        return ApiResponse.success(businessProcessService.listVersions(id));
    }

    @GetMapping("/{id}/versions/{version}")
    public ApiResponse<BusinessProcessVersionResponse> getVersion(@PathVariable UUID id,
                                                                 @PathVariable Integer version) {
        return ApiResponse.success(businessProcessService.getVersion(id, version));
    }

    @GetMapping("/{id}/flowchart")
    public ApiResponse<Map<String, Object>> flowchart(@PathVariable UUID id) {
        return ApiResponse.success(businessProcessService.getFlowchart(id));
    }
}
