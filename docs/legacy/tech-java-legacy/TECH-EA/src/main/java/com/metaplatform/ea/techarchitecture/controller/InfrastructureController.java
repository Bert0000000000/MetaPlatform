package com.metaplatform.ea.techarchitecture.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.techarchitecture.dto.CreateInfrastructureRequest;
import com.metaplatform.ea.techarchitecture.dto.InfrastructureResponse;
import com.metaplatform.ea.techarchitecture.dto.UpdateInfrastructureRequest;
import com.metaplatform.ea.techarchitecture.service.InfrastructureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/infrastructures")
@RequiredArgsConstructor
public class InfrastructureController {

    private final InfrastructureService service;

    @PostMapping
    public ApiResponse<InfrastructureResponse> create(@Valid @RequestBody CreateInfrastructureRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<InfrastructureResponse>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<InfrastructureResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<InfrastructureResponse> update(@PathVariable UUID id,
                                                       @Valid @RequestBody UpdateInfrastructureRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}