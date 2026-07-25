package com.metaplatform.mcp.jsonrpc;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@Slf4j
@RestController
@RequestMapping("/api/v1/mcp")
@RequiredArgsConstructor
public class McpStreamableHttpController {

    public static final String NDJSON = "application/x-ndjson";

    private final McpProtocolService protocolService;

    @PostMapping(value = "/servers/{serverId}/stream",
            consumes = {MediaType.APPLICATION_JSON_VALUE, NDJSON},
            produces = {NDJSON, MediaType.TEXT_EVENT_STREAM_VALUE})
    public Flux<JsonRpcResponse> stream(@PathVariable String serverId,
                                        @RequestBody JsonRpcRequest request) {
        try {
            JsonRpcResponse response = protocolService.handle(request);
            return response == null ? Flux.empty() : Flux.just(response);
        } catch (Exception e) {
            log.error("Streamable HTTP handling failed for server={}", serverId, e);
            return Flux.just(JsonRpcResponse.error(request.getId(), -32603,
                    e.getMessage() == null ? "Internal error" : e.getMessage()));
        }
    }

    @PostMapping(value = "/servers/{serverId}/stream", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonRpcResponse> requestResponse(@PathVariable String serverId,
                                                           @RequestBody JsonRpcRequest request) {
        JsonRpcResponse response = protocolService.handle(request);
        return response == null ? ResponseEntity.accepted().build() : ResponseEntity.ok(response);
    }
}
