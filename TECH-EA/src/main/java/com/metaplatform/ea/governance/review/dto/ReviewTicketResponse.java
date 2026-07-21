package com.metaplatform.ea.governance.review.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewTicketResponse {

    private UUID id;
    private String tenantId;
    private String title;
    private UUID templateId;
    private String templateName;
    private String targetType;
    private UUID targetId;
    private String applicant;
    private String reviewer;
    private String status;
    private String scores;
    private String comments;
    private String decision;
    private Instant submittedAt;
    private Instant decidedAt;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}
