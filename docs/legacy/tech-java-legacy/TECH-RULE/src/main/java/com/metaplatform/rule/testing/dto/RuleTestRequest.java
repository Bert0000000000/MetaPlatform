package com.metaplatform.rule.testing.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class RuleTestRequest {

    @NotNull(message = "输入数据不能为空")
    private Map<String, Object> inputData;
}
