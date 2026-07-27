package com.metaplatform.ea.governance.review.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateReviewTemplateRequest {

    private String name;
    private String code;
    private String description;
    private List<ReviewDimensionRequest> dimensions;
    private List<ReviewExpertRequest> experts;
    private String metadata;
}
