package com.metaplatform.msg.controller;

import com.metaplatform.msg.common.ApiResponse;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.OutboxResponse;
import com.metaplatform.msg.dto.OutboxStatsResponse;
import com.metaplatform.msg.dto.RetryResponse;
import com.metaplatform.msg.service.OutboxService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/msg/outbox")
@RequiredArgsConstructor
public class OutboxController {

    private final OutboxService outboxService;

    @GetMapping("/stats")
    public ApiResponse<OutboxStatsResponse> getStats() {
        return ApiResponse.success(outboxService.getStats());
    }

    @GetMapping
    public ApiResponse<PageResponse<OutboxResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(outboxService.listOutbox(status, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<OutboxResponse> get(@PathVariable String id) {
        return ApiResponse.success(outboxService.getOutbox(id));
    }

    @PostMapping("/{id}/retry")
    public ApiResponse<RetryResponse> retry(@PathVariable String id) {
        outboxService.retry(id);
        return ApiResponse.success(RetryResponse.builder()
                .outboxId(id)
                .previousStatus("FAILED")
                .currentStatus("PENDING")
                .retryCount(0)
                .scheduledAt(Instant.now())
                .message("Outbox 消息已加入重投队列")
                .build());
    }
}
