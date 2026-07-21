package com.metaplatform.ea.governance.review.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReviewScoreItemRequest {

    @NotBlank(message = "评分维度不能为空")
    private String dimension;

    private Integer score;
    private String comment;
}
