package com.metaplatform.rule.dto;

import com.metaplatform.rule.entity.RuleStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RuleSetCreateRequest {

    @NotBlank(message = "规则集编码不能为空")
    @Pattern(regexp = "^[a-z][a-z0-9_]*$", message = "规则集编码必须以小写字母开头，仅包含小写字母、数字、下划线")
    @Size(max = 128, message = "规则集编码长度不能超过 128")
    private String code;

    @NotBlank(message = "规则集名称不能为空")
    @Size(max = 128, message = "规则集名称长度不能超过 128")
    private String name;

    @Size(max = 2048, message = "描述长度不能超过 2048")
    private String description;

    private RuleStatus status;

    private Integer priority;

    private Boolean enabled;
}
