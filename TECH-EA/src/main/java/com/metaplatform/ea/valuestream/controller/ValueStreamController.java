package com.metaplatform.ea.valuestream.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.valuestream.dto.CreateValueStreamRequest;
import com.metaplatform.ea.valuestream.dto.CreateValueStreamStageRequest;
import com.metaplatform.ea.valuestream.dto.LinkCapabilityRequest;
import com.metaplatform.ea.valuestream.dto.UpdateValueStreamRequest;
import com.metaplatform.ea.valuestream.dto.UpdateValueStreamStageRequest;
import com.metaplatform.ea.valuestream.dto.ValueStreamResponse;
import com.metaplatform.ea.valuestream.dto.ValueStreamStageResponse;
import com.metaplatform.ea.valuestream.dto.VisualizationData;
import com.metaplatform.ea.valuestream.service.ValueStreamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/value-streams")
@RequiredArgsConstructor
public class ValueStreamController {

    private final ValueStreamService valueStreamService;

    @PostMapping
    public ApiResponse<ValueStreamResponse> create(@Valid @RequestBody CreateValueStreamRequest request) {
        return ApiResponse.success(valueStreamService.create(request));
    }

    @GetMapping
    public ApiResponse<List<ValueStreamResponse>> list() {
        return ApiResponse.success(valueStreamService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<ValueStreamResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(valueStreamService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<ValueStreamResponse> update(@PathVariable UUID id,
                                                    @Valid @RequestBody UpdateValueStreamRequest request) {
        return ApiResponse.success(valueStreamService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        valueStreamService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/capabilities")
    public ApiResponse<Void> linkCapabilities(@PathVariable UUID id,
                                              @Valid @RequestBody LinkCapabilityRequest request) {
        valueStreamService.linkCapabilities(id, request);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/visualization")
    public ApiResponse<VisualizationData> visualization(@PathVariable UUID id) {
        return ApiResponse.success(valueStreamService.visualization(id));
    }

    @PostMapping("/{id}/stages")
    public ApiResponse<ValueStreamStageResponse> createStage(@PathVariable UUID id,
                                                             @Valid @RequestBody CreateValueStreamStageRequest request) {
        return ApiResponse.success(valueStreamService.createStage(id, request));
    }

    @GetMapping("/{id}/stages")
    public ApiResponse<List<ValueStreamStageResponse>> listStages(@PathVariable UUID id) {
        return ApiResponse.success(valueStreamService.listStages(id));
    }

    @PutMapping("/{id}/stages/{stageId}")
    public ApiResponse<ValueStreamStageResponse> updateStage(@PathVariable UUID id,
                                                             @PathVariable UUID stageId,
                                                             @Valid @RequestBody UpdateValueStreamStageRequest request) {
        return ApiResponse.success(valueStreamService.updateStage(id, stageId, request));
    }

    @DeleteMapping("/{id}/stages/{stageId}")
    public ApiResponse<Void> deleteStage(@PathVariable UUID id, @PathVariable UUID stageId) {
        valueStreamService.deleteStage(id, stageId);
        return ApiResponse.success();
    }
}
