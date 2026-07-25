package com.metaplatform.a2a.inbound;

import com.metaplatform.a2a.common.ApiResponse;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.common.TenantContext;
import com.metaplatform.a2a.jsonrpc.A2aJsonRpcHandler;
import com.metaplatform.a2a.jsonrpc.JsonRpcRequest;
import com.metaplatform.a2a.jsonrpc.JsonRpcResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 入站 JSON-RPC 任务端点。
 *
 * <p>保持原有 JSON-RPC over HTTP 入口，协议方法由标准 A2A 分发器处理。</p>
 */
@RestController
@RequestMapping("/api/v1/a2a/inbound")
@RequiredArgsConstructor
public class InboundController {

    private final InboundTaskService inboundService;
    private final A2aJsonRpcHandler jsonRpcHandler;

    @PostMapping("/jsonrpc")
    public JsonRpcResponse jsonrpc(@RequestBody JsonRpcRequest request) {
        return jsonRpcHandler.handle(request);
    }

    @PostMapping("/tasks/send")
    public JsonRpcResponse handleTaskSend(@RequestBody JsonRpcRequest request) {
        request.setMethod("tasks/send");
        return jsonRpcHandler.handle(request);
    }

    @GetMapping("/tasks/{taskId}")
    public ApiResponse<Map<String, Object>> get(@PathVariable String taskId) {
        return ApiResponse.success(inboundService.handleGet(
                TenantContext.getTenantIdOrDefault(), taskId, null));
    }

    @GetMapping("/tasks")
    public ApiResponse<PageResponse<Map<String, Object>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(inboundService.list(
                TenantContext.getTenantIdOrDefault(), status, page, pageSize));
    }
}
