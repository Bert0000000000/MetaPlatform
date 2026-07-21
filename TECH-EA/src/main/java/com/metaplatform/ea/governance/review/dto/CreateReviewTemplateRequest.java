package com.metaplatform.ea.governance.review.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateReviewTemplateRequest {

    @NotBlank(message = "模板名称不能为空")
    private String name;

    @NotBlank(message = "模板编码不能为空")
    private String code;

    private String description;
    private List<ReviewDimensionRequest> dimensions;
    private List<ReviewExpertRequest> experts;
    private String metadata;
}
