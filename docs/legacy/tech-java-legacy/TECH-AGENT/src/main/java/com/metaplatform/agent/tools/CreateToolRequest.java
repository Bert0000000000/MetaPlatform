package com.metaplatform.agent.tools;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 注册工具请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateToolRequest {

    @NotBlank
    private String agentId;

    @NotBlank
    @Size(max = 256)
    private String name;

    private String description = "";

    /** ACTION / RAG / HTTP / BEAN，默认 ACTION */
    private String toolType = "ACTION";

    private Map<String, Object> config;

    private Map<String, Object> inputSchema;

    private Map<String, Object> outputSchema;

    private Boolean enabled = true;
}
