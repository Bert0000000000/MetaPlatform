package com.metaplatform.ea.dataarchitecture.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataEntityRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataEntityResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataEntityRequest;
import com.metaplatform.ea.dataarchitecture.service.DataEntityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/data-entities")
@RequiredArgsConstructor
public class DataEntityController {

    private final DataEntityService service;

    @PostMapping
    public ApiResponse<DataEntityResponse> create(@Valid @RequestBody CreateDataEntityRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<DataEntityResponse>> list(@RequestParam(required = false) UUID domainId) {
        return ApiResponse.success(service.list(domainId));
    }

    @GetMapping("/{id}")
    public ApiResponse<DataEntityResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<DataEntityResponse> update(@PathVariable UUID id,
                                                    @Valid @RequestBody UpdateDataEntityRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}