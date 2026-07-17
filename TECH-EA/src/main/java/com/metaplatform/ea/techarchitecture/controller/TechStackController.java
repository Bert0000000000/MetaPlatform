package com.metaplatform.ea.techarchitecture.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.techarchitecture.dto.CreateTechStackRequest;
import com.metaplatform.ea.techarchitecture.dto.TechStackResponse;
import com.metaplatform.ea.techarchitecture.dto.UpdateTechStackRequest;
import com.metaplatform.ea.techarchitecture.service.TechStackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/tech-stacks")
@RequiredArgsConstructor
public class TechStackController {

    private final TechStackService service;

    @PostMapping
    public ApiResponse<TechStackResponse> create(@Valid @RequestBody CreateTechStackRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<TechStackResponse>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<TechStackResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TechStackResponse> update(@PathVariable UUID id,
                                                    @Valid @RequestBody UpdateTechStackRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}