package com.metaplatform.a2a.jsonrpc;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class JsonRpcResponse {

    private final String jsonrpc;
    private final Object id;
    private final Object result;
    private final JsonRpcError error;

    public static JsonRpcResponse success(Object id, Object result) {
        return new JsonRpcResponse("2.0", id, result, null);
    }

    public static JsonRpcResponse error(Object id, int code, String message) {
        return new JsonRpcResponse("2.0", id, null, new JsonRpcError(code, message));
    }

    public record JsonRpcError(int code, String message) {
    }
}
