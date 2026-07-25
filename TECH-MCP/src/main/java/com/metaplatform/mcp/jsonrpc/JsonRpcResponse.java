package com.metaplatform.mcp.jsonrpc;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * JSON-RPC 2.0 response envelope. Either {@link #result} or {@link #error} is populated,
 * never both. For notifications the controller simply does not return a response.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JsonRpcResponse {

    public static final String JSON_RPC_VERSION = "2.0";

    /** Always {@code "2.0"}. */
    private String jsonrpc;

    /** Echo of the request id; {@code null} for notifications (response is not returned). */
    private Object id;

    /** Successful result — present iff {@link #error} is {@code null}. */
    private Object result;

    /** Error object — present iff {@link #result} is {@code null}. */
    private Error error;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Error {
        /** Numeric error code. Standard JSON-RPC codes or implementation-defined. */
        private int code;

        /** Short human-readable message. */
        private String message;

        /** Optional structured error data (e.g. validation details). */
        private Object data;
    }

    public static JsonRpcResponse success(Object id, Object result) {
        return JsonRpcResponse.builder()
                .jsonrpc(JSON_RPC_VERSION)
                .id(id)
                .result(result)
                .build();
    }

    public static JsonRpcResponse error(Object id, int code, String message) {
        return JsonRpcResponse.builder()
                .jsonrpc(JSON_RPC_VERSION)
                .id(id)
                .error(Error.builder().code(code).message(message).build())
                .build();
    }

    public static JsonRpcResponse error(Object id, int code, String message, Object data) {
        return JsonRpcResponse.builder()
                .jsonrpc(JSON_RPC_VERSION)
                .id(id)
                .error(Error.builder().code(code).message(message).data(data).build())
                .build();
    }
}