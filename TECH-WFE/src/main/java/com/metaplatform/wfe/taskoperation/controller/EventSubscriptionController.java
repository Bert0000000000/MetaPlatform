package com.metaplatform.wfe.taskoperation.controller;

import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.taskoperation.dto.EventSubscriptionRequest;
import com.metaplatform.wfe.taskoperation.dto.EventSubscriptionResponse;
import com.metaplatform.wfe.taskoperation.service.EventSubscriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/wfe/event-subscriptions")
@RequiredArgsConstructor
public class EventSubscriptionController {

    private final EventSubscriptionService service;

    @PostMapping
    public ApiResponse<EventSubscriptionResponse> subscribe(@Valid @RequestBody EventSubscriptionRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<EventSubscriptionResponse>> list() {
        return ApiResponse.success(service.listMine());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ApiResponse.success();
    }
}