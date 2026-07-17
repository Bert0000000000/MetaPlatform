package com.metaplatform.mcp.prompt.dto;

import lombok.Data;

import java.util.Map;

@Data
public class RenderRequest {

    private Map<String, Object> variables;
}