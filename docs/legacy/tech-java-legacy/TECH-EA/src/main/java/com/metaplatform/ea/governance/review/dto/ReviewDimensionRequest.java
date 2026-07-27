package com.metaplatform.ea.governance.review.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReviewDimensionRequest {

    @NotBlank(message = "维度名称不能为空")
    private String name;

    private Integer weight;
    private Integer maxScore;
    private String description;
}
