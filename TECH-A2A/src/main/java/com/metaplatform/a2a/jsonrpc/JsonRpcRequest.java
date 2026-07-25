package com.metaplatform.a2a.jsonrpc;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class JsonRpcRequest {

    private String jsonrpc;
    private Object id;
    private String method;
    private Map<String, Object> params;
}
