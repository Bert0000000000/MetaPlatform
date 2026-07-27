package com.metaplatform.action.trigger.controller;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.trigger.dto.CreateTriggerRequest;
import com.metaplatform.action.trigger.dto.TriggerListItem;
import com.metaplatform.action.trigger.dto.TriggerResponse;
import com.metaplatform.action.trigger.dto.UpdateTriggerRequest;
import com.metaplatform.action.trigger.service.ActionTriggerService;
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
@RequestMapping("/api/v1/action/triggers")
@RequiredArgsConstructor
public class ActionTriggerController {

    private final ActionTriggerService actionTriggerService;

    @PostMapping
    public ApiResponse<TriggerResponse> create(@Valid @RequestBody CreateTriggerRequest request) {
        return ApiResponse.success(actionTriggerService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<TriggerListItem>> list(
            @RequestParam(required = false) String actionId,
            @RequestParam(required = false) String triggerType,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(actionTriggerService.list(actionId, triggerType, enabled, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<TriggerResponse> get(@PathVariable String id) {
        return ApiResponse.success(actionTriggerService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TriggerResponse> update(@PathVariable String id,
                                               @Valid @RequestBody UpdateTriggerRequest request) {
        return ApiResponse.success(actionTriggerService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        actionTriggerService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/enable")
    public ApiResponse<TriggerResponse> enable(@PathVariable String id) {
        return ApiResponse.success(actionTriggerService.enable(id));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<TriggerResponse> disable(@PathVariable String id) {
        return ApiResponse.success(actionTriggerService.disable(id));
    }

    @PostMapping("/{id}/fire")
    public ApiResponse<SyncExecutionResponse> fire(@PathVariable String id) {
        return ApiResponse.success(actionTriggerService.fire(id));
    }
}
