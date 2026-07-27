package com.metaplatform.ea.role.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleResponse {

    private UUID id;
    private String name;
    private String code;
    private String description;
    private String responsibility;
    private UUID orgUnitId;
    private String domain;
    private List<UUID> iamRoleIds;
    private Long processCount;
    private Instant createdAt;
    private Instant updatedAt;
}
