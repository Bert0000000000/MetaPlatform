package com.metaplatform.ea.review.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateArchitectureReviewRequest {

    @NotBlank(message = "评审标题不能为空")
    private String title;

    @NotBlank(message = "reviewType 不能为空")
    private String reviewType;

    private UUID targetId;
    private String targetType;
    private String summary;
    private String reviewer;
    private String metadata;
}