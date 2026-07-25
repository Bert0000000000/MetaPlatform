package com.metaplatform.agent.agents.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 克隆 Agent 请求：以源 Agent 为模板创建新 Agent，仅指定新名称与编码。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CloneAgentRequest {

    @NotBlank
    @Size(min = 1, max = 256)
    private String newName;

    @NotBlank
    @Size(min = 1, max = 128)
    private String newAgentCode;
}
