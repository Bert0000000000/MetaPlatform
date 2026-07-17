package com.metaplatform.rule.decisiontable.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableRowResponse {

    private String id;
    private String tableId;
    private Integer rowOrder;
    private Map<String, Object> inputValues;
    private Map<String, Object> outputValues;
    private Boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
}
