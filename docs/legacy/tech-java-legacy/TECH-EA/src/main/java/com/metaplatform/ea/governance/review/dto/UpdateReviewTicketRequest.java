package com.metaplatform.ea.governance.review.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateReviewTicketRequest {

    private String title;
    private UUID templateId;
    private String targetType;
    private UUID targetId;
    private String applicant;
    private String reviewer;
    private String metadata;
}
