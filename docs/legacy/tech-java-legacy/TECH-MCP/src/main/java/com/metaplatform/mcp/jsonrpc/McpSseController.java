package com.metaplatform.mcp.jsonrpc;

import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.common.TraceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequestMapping("/api/v1/mcp")
@RequiredArgsConstructor
public class McpSseController {

    private static final long SSE_TIMEOUT_MS = 300_000L;

    private final McpProtocolService protocolService;
    private final Map<String, SseSession> sessionStore = new ConcurrentHashMap<>();

    @GetMapping(value = "/servers/{serverId}/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter sseConnect(@PathVariable String serverId) {
        String sessionId = UUID.randomUUID().toString();
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        sessionStore.put(sessionId, new SseSession(emitter, serverId, TenantContext.getOrDefault(), TraceContext.getOrCreate()));
        Runnable cleanup = () -> sessionStore.remove(sessionId);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(error -> cleanup.run());
        try {
            emitter.send(SseEmitter.event()
                    .name("endpoint")
                    .data("/api/v1/mcp/servers/" + serverId + "/messages?sessionId=" + sessionId));
        } catch (IOException e) {
            cleanup.run();
            emitter.completeWithError(e);
        }
        return emitter;
    }

    @PostMapping("/servers/{serverId}/messages")
    public ResponseEntity<Void> postMessage(@PathVariable String serverId,
                                            @RequestParam String sessionId,
                                            @RequestBody JsonRpcRequest request) {
        SseSession session = sessionStore.get(sessionId);
        if (session == null || !session.serverId().equals(serverId)) {
            return ResponseEntity.notFound().build();
        }
        try {
            TenantContext.set(session.tenantId());
            TraceContext.set(session.traceId());
            JsonRpcResponse response = protocolService.handle(request);
            if (response != null) {
                session.emitter().send(SseEmitter.event().name("message").data(response));
            }
            return ResponseEntity.accepted().build();
        } catch (Exception e) {
            log.error("Failed to send SSE response for session={}", sessionId, e);
            try {
                session.emitter().send(SseEmitter.event().name("error")
                        .data(JsonRpcResponse.error(request.getId(), -32603,
                                e.getMessage() == null ? "Internal error" : e.getMessage())));
            } catch (IOException sendError) {
                session.emitter().completeWithError(sendError);
                sessionStore.remove(sessionId);
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } finally {
            TenantContext.clear();
            TraceContext.clear();
        }
    }

    private record SseSession(SseEmitter emitter, String serverId, String tenantId, String traceId) {
    }
}
