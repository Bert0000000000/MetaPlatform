package com.metaplatform.rule.testcase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class CreateTestCaseRequest {

    private String ruleId;

    private String rulesetId;

    private String targetType;

    private String targetId;

    @NotBlank(message = "测试用例名称不能为空")
    private String name;

    @NotNull(message = "输入数据不能为空")
    private Map<String, Object> input;

    private Map<String, Object> expectedOutput;
}
