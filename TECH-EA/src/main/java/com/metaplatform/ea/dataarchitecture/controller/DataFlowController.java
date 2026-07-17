package com.metaplatform.ea.dataarchitecture.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataFlowRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataFlowResponse;
import com.metaplatform.ea.dataarchitecture.service.DataFlowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/data-flows")
@RequiredArgsConstructor
public class DataFlowController {

    private final DataFlowService service;

    @PostMapping
    public ApiResponse<DataFlowResponse> create(@Valid @RequestBody CreateDataFlowRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<DataFlowResponse>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<DataFlowResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}