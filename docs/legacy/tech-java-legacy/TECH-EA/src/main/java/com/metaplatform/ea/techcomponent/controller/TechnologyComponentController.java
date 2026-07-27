package com.metaplatform.ea.techcomponent.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.techcomponent.dto.CreateTechnologyComponentRequest;
import com.metaplatform.ea.techcomponent.dto.TechnologyComponentResponse;
import com.metaplatform.ea.techcomponent.dto.UpdateTechnologyComponentRequest;
import com.metaplatform.ea.techcomponent.service.TechnologyComponentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/technology-components")
@RequiredArgsConstructor
public class TechnologyComponentController {

    private final TechnologyComponentService service;

    @PostMapping
    public ApiResponse<TechnologyComponentResponse> create(@Valid @RequestBody CreateTechnologyComponentRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<TechnologyComponentResponse>> list(@RequestParam(required = false) String type) {
        if (type != null && !type.isBlank()) {
            return ApiResponse.success(service.listByType(type));
        }
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<TechnologyComponentResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TechnologyComponentResponse> update(@PathVariable UUID id,
                                                            @Valid @RequestBody UpdateTechnologyComponentRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}
