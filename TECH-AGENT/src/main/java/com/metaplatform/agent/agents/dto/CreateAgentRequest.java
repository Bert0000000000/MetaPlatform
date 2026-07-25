package com.metaplatform.agent.agents.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 创建 Agent 请求。
 *
 * <p>字段命名遵循前端约定（camelCase）。{@code code} 对应 Agent 的 agentCode。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateAgentRequest {

    @NotBlank
    @Size(max = 256)
    private String name;

    @NotBlank
    @Size(max = 128)
    private String code;

    private String description = "";

    @NotBlank
    @Size(max = 256)
    private String modelId;

    @NotBlank
    @Size(max = 8192)
    private String systemPrompt;

    private List<String> tools;

    private List<String> ragScopes;

    private Double temperature = 0.7;

    private Integer maxTokens = 4096;

    /** 初始状态，默认 DRAFT。 */
    private String status = "DRAFT";
}
