package com.metaplatform.data.deliverables.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 交付物响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliverableResponse {

    private String id;
    private String tenantId;
    private String type;
    private String title;
    private String source;
    private String description;
    private String format;
    private String status;
    private Integer size;
    private String createdBy;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String downloadUrl;
}
