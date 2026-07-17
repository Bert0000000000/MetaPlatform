package com.metaplatform.ea.debt.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.debt.dto.CreateTechStandardRequest;
import com.metaplatform.ea.debt.dto.TechStandardResponse;
import com.metaplatform.ea.debt.dto.UpdateTechStandardRequest;
import com.metaplatform.ea.debt.service.TechStandardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/tech-standards")
@RequiredArgsConstructor
public class TechStandardController {

    private final TechStandardService service;

    @PostMapping
    public ApiResponse<TechStandardResponse> create(@Valid @RequestBody CreateTechStandardRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<TechStandardResponse>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<TechStandardResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TechStandardResponse> update(@PathVariable UUID id,
                                                    @Valid @RequestBody UpdateTechStandardRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}