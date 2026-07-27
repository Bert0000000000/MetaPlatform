package com.metaplatform.agent.agents.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 更新 Agent 请求 — 所有字段可选，仅更新传入字段。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateAgentRequest {

    @Size(min = 1, max = 256)
    private String name;

    @Size(min = 1, max = 128)
    private String code;

    private String description;

    @Size(min = 1, max = 256)
    private String modelId;

    @Size(min = 1, max = 8192)
    private String systemPrompt;

    private List<String> tools;

    private List<String> ragScopes;

    private Double temperature;

    private Integer maxTokens;

    private String status;
}
