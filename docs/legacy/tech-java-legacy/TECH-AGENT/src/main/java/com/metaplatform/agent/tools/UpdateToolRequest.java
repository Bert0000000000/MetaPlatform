package com.metaplatform.agent.tools;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 更新工具请求（所有字段可选）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateToolRequest {

    private String name;
    private String description;
    private String toolType;
    private Map<String, Object> config;
    private Map<String, Object> inputSchema;
    private Map<String, Object> outputSchema;
}
