package com.metaplatform.action.definition.controller;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.definition.dto.ActionDefinitionListItem;
import com.metaplatform.action.definition.dto.ActionDefinitionResponse;
import com.metaplatform.action.definition.dto.CreateActionDefinitionRequest;
import com.metaplatform.action.definition.dto.UpdateActionDefinitionRequest;
import com.metaplatform.action.definition.service.ActionDefinitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/action/definitions")
@RequiredArgsConstructor
public class ActionDefinitionController {

    private final ActionDefinitionService actionDefinitionService;

    @PostMapping
    public ApiResponse<ActionDefinitionResponse> create(@Valid @RequestBody CreateActionDefinitionRequest request) {
        return ApiResponse.success(actionDefinitionService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<ActionDefinitionListItem>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(actionDefinitionService.list(status, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<ActionDefinitionResponse> get(@PathVariable String id) {
        return ApiResponse.success(actionDefinitionService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<ActionDefinitionResponse> update(@PathVariable String id,
                                                        @Valid @RequestBody UpdateActionDefinitionRequest request) {
        return ApiResponse.success(actionDefinitionService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        actionDefinitionService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<ActionDefinitionResponse> publish(@PathVariable String id) {
        return ApiResponse.success(actionDefinitionService.publish(id));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<ActionDefinitionResponse> disable(@PathVariable String id) {
        return ApiResponse.success(actionDefinitionService.disable(id));
    }
}
