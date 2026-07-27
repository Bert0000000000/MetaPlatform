package com.metaplatform.mcp.tool.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpToolVersionCompareResponse {

    private McpToolVersionResponse left;
    private McpToolVersionResponse right;
    private List<String> differences;
}
