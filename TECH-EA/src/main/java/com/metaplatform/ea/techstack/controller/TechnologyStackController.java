package com.metaplatform.ea.techstack.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.techstack.dto.CreateTechnologyStackRequest;
import com.metaplatform.ea.techstack.dto.TechnologyStackResponse;
import com.metaplatform.ea.techstack.dto.UpdateTechnologyStackRequest;
import com.metaplatform.ea.techstack.service.TechnologyStackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/technology-stacks")
@RequiredArgsConstructor
public class TechnologyStackController {

    private final TechnologyStackService service;

    @PostMapping
    public ApiResponse<TechnologyStackResponse> create(@Valid @RequestBody CreateTechnologyStackRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<TechnologyStackResponse>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<TechnologyStackResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TechnologyStackResponse> update(@PathVariable UUID id,
                                                        @Valid @RequestBody UpdateTechnologyStackRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}
