package com.metaplatform.rule.testcase.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateTestCaseRequest {

    private String name;
    private String targetType;
    private String targetId;
    private Map<String, Object> input;
    private Map<String, Object> expectedOutput;
}
