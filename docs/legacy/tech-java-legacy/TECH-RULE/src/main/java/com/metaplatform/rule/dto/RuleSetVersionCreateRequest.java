package com.metaplatform.rule.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RuleSetVersionCreateRequest {

    @Size(max = 2048, message = "版本描述长度不能超过 2048")
    private String description;
}
