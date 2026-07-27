package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * MCP {@code tools/call} response. Carries one or more {@link Content} items plus an
 * {@code isError} flag distinguishing successful tool responses from error ones.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CallToolResult {

    /** Ordered list of content blocks (text/image/embedded resource). */
    private List<Content> content;

    /**
     * {@code true} if the tool itself failed (vs the transport/protocol).
     * Transport-level errors are surfaced as JSON-RPC errors, not via this flag.
     */
    private Boolean isError;

    /** Reserved for transport / SDK use (e.g. progress tokens). */
    private Map<String, Object> meta;
}