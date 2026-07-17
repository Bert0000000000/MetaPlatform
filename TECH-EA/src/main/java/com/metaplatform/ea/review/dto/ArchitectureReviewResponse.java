package com.metaplatform.ea.review.dto;

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
public class ArchitectureReviewResponse {
    private UUID id;
    private String tenantId;
    private String title;
    private String reviewType;
    private UUID targetId;
    private String targetType;
    private String status;
    private String summary;
    private String decision;
    private String comments;
    private String attachments;
    private String createdBy;
    private String reviewer;
    private Instant submittedAt;
    private Instant decidedAt;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}