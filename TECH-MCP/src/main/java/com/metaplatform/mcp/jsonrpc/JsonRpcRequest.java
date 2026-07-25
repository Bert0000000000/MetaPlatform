package com.metaplatform.mcp.jsonrpc;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * JSON-RPC 2.0 request envelope.
 *
 * <ul>
 *   <li>{@code id} is {@code null} for notifications (no response expected)</li>
 *   <li>{@code params} is an arbitrary structured object; we deserialize to {@code Map<String, Object>}
 *       so that any JSON-RPC compliant client payload is accepted</li>
 * </ul>
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class JsonRpcRequest {

    /** Always {@code "2.0"} per JSON-RPC 2.0 spec. */
    private String jsonrpc;

    /** Request identifier — may be String, Integer or Long. {@code null} indicates a notification. */
    private Object id;

    /** Method name, e.g. {@code "initialize"}, {@code "tools/call"}. */
    private String method;

    /** Structured parameters as a JSON object. */
    private java.util.Map<String, Object> params;

    /** Convenience helper used by handlers. */
    public boolean isNotification() {
        return id == null;
    }
}