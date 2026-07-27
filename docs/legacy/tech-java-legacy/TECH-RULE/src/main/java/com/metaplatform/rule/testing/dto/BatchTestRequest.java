package com.metaplatform.rule.testing.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class BatchTestRequest {

    @NotNull(message = "测试项列表不能为空")
    private List<BatchTestItem> items;

    @Data
    public static class BatchTestItem {
        private String ruleId;
        private Map<String, Object> inputData;
    }
}
