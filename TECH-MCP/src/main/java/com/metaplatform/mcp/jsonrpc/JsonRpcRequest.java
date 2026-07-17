package com.metaplatform.mcp.jsonrpc;

import lombok.Data;

@Data
public class JsonRpcRequest {

    private String jsonrpc;
    private Object id;
    private String method;
    private java.util.Map<String, Object> params;
}
