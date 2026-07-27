package com.metaplatform.ea.review.dto;

import lombok.Data;

@Data
public class UpdateArchitectureReviewRequest {
    private String title;
    private String summary;
    private String decision;
    private String reviewer;
    private String metadata;
}