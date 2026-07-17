package com.metaplatform.msg.controller;

import com.metaplatform.msg.common.ApiResponse;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.BatchResendRequest;
import com.metaplatform.msg.dto.BatchResendResponse;
import com.metaplatform.msg.dto.DlqMessageResponse;
import com.metaplatform.msg.service.DlqMessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/msg/dlq")
@RequiredArgsConstructor
public class DlqMessageController {

    private final DlqMessageService dlqMessageService;

    @GetMapping
    public ApiResponse<PageResponse<DlqMessageResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(dlqMessageService.list(tenantId, topic, status, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<DlqMessageResponse> getById(@PathVariable String id) {
        return ApiResponse.success(dlqMessageService.getById(id));
    }

    @PostMapping("/{id}/resend")
    public ApiResponse<DlqMessageResponse> resend(@PathVariable String id) {
        return ApiResponse.success(dlqMessageService.resend(id));
    }

    @PostMapping("/batch-resend")
    public ApiResponse<BatchResendResponse> batchResend(@Valid @RequestBody BatchResendRequest request) {
        return ApiResponse.success(dlqMessageService.batchResend(request.getIds()));
    }
}
