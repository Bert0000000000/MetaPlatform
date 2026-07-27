package com.metaplatform.data.quality.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 创建质量规则请求。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateQualityRuleRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String targetAssetId;

    @NotBlank
    private String ruleType;

    private String expression;
    private String severity = "MAJOR";
    private Map<String, Object> config;
    private String description = "";
}
