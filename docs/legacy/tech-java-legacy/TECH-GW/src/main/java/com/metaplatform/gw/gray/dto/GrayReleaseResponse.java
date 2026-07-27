package com.metaplatform.gw.gray.dto;

import com.metaplatform.gw.gray.entity.GwGrayReleaseEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GrayReleaseResponse {
    private UUID id;
    private String tenantId;
    private UUID apiId;
    private String name;
    private String status;
    private String strategy;
    private Map<String, Object> strategyConfig;
    private String newVersion;
    private String oldVersion;
    private Instant startAt;
    private Instant endAt;
    private Instant createdAt;
    private Instant updatedAt;

    public static GrayReleaseResponse fromEntity(GwGrayReleaseEntity entity) {
        return GrayReleaseResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .apiId(entity.getApiId())
                .name(entity.getName())
                .status(entity.getStatus())
                .strategy(entity.getStrategy())
                .strategyConfig(entity.getStrategyConfig())
                .newVersion(entity.getNewVersion())
                .oldVersion(entity.getOldVersion())
                .startAt(entity.getStartAt())
                .endAt(entity.getEndAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}