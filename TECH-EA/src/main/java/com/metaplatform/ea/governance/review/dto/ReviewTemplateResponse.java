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
public class ReviewTemplateResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private String description;
    private String dimensions;
    private String experts;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}
