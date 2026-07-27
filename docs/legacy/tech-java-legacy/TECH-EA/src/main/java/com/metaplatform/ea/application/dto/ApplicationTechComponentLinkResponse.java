package com.metaplatform.ea.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * 应用-技术组件关联记录响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationTechComponentLinkResponse {

    private UUID id;
    private String tenantId;
    private UUID applicationId;
    private UUID techComponentId;
    private String techComponentName;
    private String techComponentType;
    private String relationshipType;
    private Instant createdAt;
    private Instant updatedAt;
}
