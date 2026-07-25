package com.metaplatform.llmgw.models;

import com.metaplatform.llmgw.common.ApiResponse;
import com.metaplatform.llmgw.models.dto.CreateModelRequest;
import com.metaplatform.llmgw.models.dto.ModelDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/llmgw/models")
@RequiredArgsConstructor
public class ModelController {

    private final ModelService modelService;

    @GetMapping
    public ApiResponse<List<ModelDto>> listAll() {
        return ApiResponse.ok(modelService.listModels(false));
    }

    @GetMapping("/active")
    public ApiResponse<List<ModelDto>> listActive() {
        return ApiResponse.ok(modelService.listModels(true));
    }

    @GetMapping("/{id}")
    public ApiResponse<ModelDto> getById(@PathVariable Long id) {
        return ApiResponse.ok(modelService.getModel(id));
    }

    @PostMapping
    public ApiResponse<ModelDto> create(@RequestBody CreateModelRequest request) {
        return ApiResponse.ok(modelService.createModel(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<ModelDto> update(@PathVariable Long id, @RequestBody CreateModelRequest request) {
        return ApiResponse.ok(modelService.updateModel(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        modelService.deleteModel(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/sync")
    public ApiResponse<Integer> syncModels(@RequestBody List<CreateModelRequest> requests) {
        return ApiResponse.ok(modelService.syncModels(requests));
    }
}
