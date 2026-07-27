package com.metaplatform.msg.controller;

import com.metaplatform.msg.common.ApiResponse;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.AckRequest;
import com.metaplatform.msg.dto.AckResponse;
import com.metaplatform.msg.dto.ConsumerGroupRequest;
import com.metaplatform.msg.dto.ConsumerGroupResponse;
import com.metaplatform.msg.service.ConsumerGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/msg/consumer-groups")
@RequiredArgsConstructor
public class ConsumerGroupController {

    private final ConsumerGroupService consumerGroupService;

    @PostMapping
    public ApiResponse<ConsumerGroupResponse> register(@Valid @RequestBody ConsumerGroupRequest request) {
        return ApiResponse.success(consumerGroupService.register(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<ConsumerGroupResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(consumerGroupService.list(tenantId, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<ConsumerGroupResponse> get(@PathVariable String id) {
        return ApiResponse.success(consumerGroupService.get(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        consumerGroupService.unregister(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/ack")
    public ApiResponse<AckResponse> ack(@PathVariable String id,
                                        @Valid @RequestBody AckRequest request) {
        return ApiResponse.success(consumerGroupService.ack(id, request));
    }
}
