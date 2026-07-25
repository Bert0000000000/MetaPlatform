package com.metaplatform.mcp.jsonrpc;

import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * JSON-RPC 2.0 entry points for the MCP server.
 *
 * <ul>
 *   <li>{@code POST /api/v1/mcp/jsonrpc} — standard MCP endpoint, single shared protocol
 *       dispatcher</li>
 *   <li>{@code POST /api/v1/mcp/servers/{serverId}/rpc} — multi-tenant routing: the request
 *       is only honoured if the {@code serverId} exists and is owned by the current tenant</li>
 * </ul>
 *
 * <p>All dispatching logic lives in {@link McpProtocolService}; this controller is a thin
 * HTTP shell. The raw {@link #handle(JsonRpcRequest)} entry point is preserved so that
 * internal callers (e.g. {@code McpDebugService}) can reuse it without HTTP semantics.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/mcp")
@RequiredArgsConstructor
public class JsonRpcController {

    private final McpProtocolService mcpProtocolService;
    private final McpServerRepository mcpServerRepository;

    /**
     * Raw dispatch — returns the JSON-RPC response directly. Used by HTTP handlers and by
     * internal service callers (e.g. debug tools) that want to invoke the protocol without
     * going through Spring MVC.
     *
     * <p>Returns {@code null} for notifications (no {@code id}); callers must handle that
     * case (HTTP layer writes 204, internal callers simply drop it).</p>
     */
    public JsonRpcResponse handle(JsonRpcRequest request) {
        return mcpProtocolService.handle(request);
    }

    /**
     * Standard MCP JSON-RPC endpoint. Returns HTTP 204 No Content for notifications.
     */
    @PostMapping(value = "/jsonrpc")
    public ResponseEntity<JsonRpcResponse> handleHttp(@RequestBody JsonRpcRequest request) {
        JsonRpcResponse response = mcpProtocolService.handle(request);
        if (response == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(response);
    }

    /**
     * Multi-tenant routing. Validates that the supplied {@code serverId} belongs to the
     * current tenant and is not soft-deleted; rejects with 404 otherwise.
     */
    @PostMapping(value = "/servers/{serverId}/rpc")
    public ResponseEntity<JsonRpcResponse> handleForServer(@PathVariable("serverId") UUID serverId,
                                                           @RequestBody JsonRpcRequest request) {
        validateServer(serverId);
        JsonRpcResponse response = mcpProtocolService.handle(request);
        if (response == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(response);
    }

    private void validateServer(UUID serverId) {
        McpServerEntity entity = mcpServerRepository.findByIdAndDeletedAtIsNull(serverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "MCP Server not found: " + serverId));
        String tenantId = TenantContext.getOrDefault();
        if (!entity.getTenantId().equals(tenantId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "MCP Server not found in current tenant: " + serverId);
        }
    }
}