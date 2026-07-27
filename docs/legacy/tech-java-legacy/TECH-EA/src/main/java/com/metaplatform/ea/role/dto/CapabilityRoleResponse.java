package com.metaplatform.ea.role.dto;

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
public class CapabilityRoleResponse {

    private UUID id;
    private UUID capabilityId;
    private UUID roleId;
    private String roleName;
    private String roleCode;
    private String relationship;
    private Instant createdAt;
}
