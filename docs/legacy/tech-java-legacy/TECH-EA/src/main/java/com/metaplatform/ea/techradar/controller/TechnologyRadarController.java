package com.metaplatform.ea.techradar.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.techradar.dto.CreateTechnologyRadarRequest;
import com.metaplatform.ea.techradar.dto.TechnologyRadarResponse;
import com.metaplatform.ea.techradar.dto.UpdateTechnologyRadarRequest;
import com.metaplatform.ea.techradar.service.TechnologyRadarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/technology-radar")
@RequiredArgsConstructor
public class TechnologyRadarController {

    private final TechnologyRadarService service;

    @PostMapping
    public ApiResponse<TechnologyRadarResponse> create(@Valid @RequestBody CreateTechnologyRadarRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<TechnologyRadarResponse>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<TechnologyRadarResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TechnologyRadarResponse> update(@PathVariable UUID id,
                                                        @Valid @RequestBody UpdateTechnologyRadarRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}
