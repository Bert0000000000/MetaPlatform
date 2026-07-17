package com.metaplatform.ea.dataarchitecture.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataDomainRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataDomainResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataDomainRequest;
import com.metaplatform.ea.dataarchitecture.service.DataDomainService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/data-domains")
@RequiredArgsConstructor
public class DataDomainController {

    private final DataDomainService service;

    @PostMapping
    public ApiResponse<DataDomainResponse> create(@Valid @RequestBody CreateDataDomainRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<DataDomainResponse>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<DataDomainResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<DataDomainResponse> update(@PathVariable UUID id,
                                                    @Valid @RequestBody UpdateDataDomainRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}