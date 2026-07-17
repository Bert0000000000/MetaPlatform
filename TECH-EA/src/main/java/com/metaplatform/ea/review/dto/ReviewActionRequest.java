package com.metaplatform.ea.review.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReviewActionRequest {

    @NotBlank(message = "评论或决策内容不能为空")
    private String comment;

    private String reviewer;
    private String decision;
}