package com.metaplatform.wfe.apphub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateCommentResponse {

    private String id;
    private String templateId;
    private String userId;
    private Integer rating;
    private String comment;
    private Instant createdAt;
    private Instant updatedAt;
}
