package com.metaplatform.mcp.jsonrpc;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JsonRpcResponse {

    private String jsonrpc;
    private Object id;
    private Object result;
    private Error error;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Error {
        private int code;
        private String message;
    }

    public static JsonRpcResponse success(Object id, Object result) {
        return JsonRpcResponse.builder()
                .jsonrpc("2.0")
                .id(id)
                .result(result)
                .build();
    }

    public static JsonRpcResponse error(Object id, int code, String message) {
        return JsonRpcResponse.builder()
                .jsonrpc("2.0")
                .id(id)
                .error(Error.builder().code(code).message(message).build())
                .build();
    }
}
