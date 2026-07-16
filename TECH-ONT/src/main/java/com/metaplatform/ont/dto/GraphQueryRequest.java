package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GraphQueryRequest {

    @NotBlank(message = "起始节点 ID 不能为空")
    private String startNodeId;

    @Min(value = 1, message = "查询深度最小为 1")
    @Max(value = 5, message = "查询深度最大为 5")
    private Integer depth = 2;

    private String relationType;
}
