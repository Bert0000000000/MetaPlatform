package com.metaplatform.ea.dataarchitecture.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataStandardRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataStandardResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataStandardRequest;
import com.metaplatform.ea.dataarchitecture.service.DataStandardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/data-standards")
@RequiredArgsConstructor
public class DataStandardController {

    private final DataStandardService service;

    @PostMapping
    public ApiResponse<DataStandardResponse> create(@Valid @RequestBody CreateDataStandardRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<DataStandardResponse>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<DataStandardResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<DataStandardResponse> update(@PathVariable UUID id,
                                                      @Valid @RequestBody UpdateDataStandardRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}
